import { z } from 'zod';
import { randomInt } from 'node:crypto';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { parseTranscript } from '../transcripts';
import { countWords } from '../metrics';
import { MAX_TRANSCRIPT_BYTES, MAX_EXAMPLE_PROMPT_BYTES } from '../constants';
import { InvalidReview } from '../review/schema';
import { abortable, type Provider } from '../review/judge';
import { SafeError } from '../server/errors';
import { EXAMPLE_INSTRUCTIONS, EXAMPLE_MODEL, EXAMPLE_OUTPUT_TOKENS, EXAMPLE_PROMPT_VERSION, SCENARIOS, type ScenarioId } from './prompt';

export const exampleRequestSchema = z.strictObject({requestId:z.uuid(),challengeToken:z.string().max(2048).optional(),previousScenario:z.enum(Object.keys(SCENARIOS) as [ScenarioId,...ScenarioId[]]).optional()});
export const exampleOutputSchema = z.strictObject({title:z.string().trim().min(1).max(100),segments:z.array(z.strictObject({speaker:z.enum(['Adviser','Client A','Client B']),text:z.string().trim().min(1).max(1600)})).min(70).max(160)});
const jsonSchema = z.toJSONSchema(exampleOutputSchema,{target:'draft-7'});
const emphases = ['Thoughtful opening and reflections, but an overly adviser-led close.', 'Clear decisions, but some jargon and weak checks for understanding.', 'Good explanations, but uneven attention to the quieter partner.', 'Good individual goals, but worry is answered too quickly.', 'Useful emotional acknowledgement, but actions and obstacles stay vague.', 'Good practical next steps, but some recommendations lose the link to personal goals.'];

export function exampleParameters(scenario:ScenarioId,variation:string,emphasis:string,correction?:string):ResponseCreateParamsNonStreaming {
  return {model:EXAMPLE_MODEL,reasoning:{effort:'low'},service_tier:'default',store:false,background:false,max_output_tokens:EXAMPLE_OUTPUT_TOKENS,
    instructions:EXAMPLE_INSTRUCTIONS+(correction?`\nThe previous attempt failed ${correction}. Return a complete new transcript meeting every constraint, not a continuation.`:''),
    input:[{role:'user',content:JSON.stringify({scenario:SCENARIOS[scenario],variation,emphasis})}],
    text:{format:{type:'json_schema',name:'meeting_coach_synthetic_example_v1',strict:true,schema:jsonSchema}}};
}

export function validateExample(raw:unknown,scenario:ScenarioId,exampleId:string){
  const result=exampleOutputSchema.safeParse(raw);if(!result.success)throw new InvalidReview('example_shape');
  const segments=result.data.segments.map(s=>({...s,text:s.text.replace(/\s+/g,' ')}));
  const wordCount=segments.reduce((n,s)=>n+countWords(s.text),0);
  if(wordCount<6300||wordCount>7700)throw new InvalidReview('example_word_count_6300_to_7700');
  for(const speaker of ['Adviser','Client A','Client B']){
    const turns=segments.filter(s=>s.speaker===speaker);
    if(turns.length<8||turns.reduce((n,s)=>n+countWords(s.text),0)<350)throw new InvalidReview('example_speaker_coverage');
  }
  let elapsedWords=0;
  const transcript=segments.map(s=>{const seconds=Math.floor(elapsedWords/140*60);elapsedWords+=countWords(s.text);const stamp=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');return `${s.speaker}\n${stamp}\n${s.text}`;}).join('\n\n');
  if(Buffer.byteLength(transcript,'utf8')>MAX_TRANSCRIPT_BYTES)throw new InvalidReview('example_size');
  const parsed=parseTranscript(transcript);if(parsed.totalWords!==wordCount||parsed.speakers.length!==3)throw new InvalidReview('example_attribution');
  return {transcript,title:`Synthetic: ${result.data.title}`,wordCount,durationSeconds:Math.ceil(wordCount/140*60),scenarioId:scenario,exampleId,model:EXAMPLE_MODEL,promptVersion:EXAMPLE_PROMPT_VERSION,synthetic:true as const,timestamps:'simulated-from-word-count' as const};
}
export type GeneratedExample=ReturnType<typeof validateExample>;

export async function generateExample(input:z.infer<typeof exampleRequestSchema>,timeout:number,provider:Provider,reserve:()=>Promise<void>,parent:AbortSignal){
  const choices=(Object.keys(SCENARIOS) as ScenarioId[]).filter(s=>s!==input.previousScenario);
  const scenario=choices[randomInt(choices.length)],emphasis=emphases[randomInt(emphases.length)],variation=crypto.randomUUID();
  const signal=AbortSignal.any([parent,AbortSignal.timeout(timeout)]);let correction:string|undefined;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const parameters=exampleParameters(scenario,variation,emphasis,correction);
      if(Buffer.byteLength(JSON.stringify(parameters),'utf8')>MAX_EXAMPLE_PROMPT_BYTES)throw new SafeError(413,'tokens','The example request exceeds the generation budget.');
      signal.throwIfAborted();await reserve();signal.throwIfAborted();
      const response=await abortable(provider(parameters,signal),signal);
      if(response.status!=='completed')throw new SafeError(502,'incomplete','The example did not finish. Your current transcript is unchanged; please try again.');
      if(response.output.some(o=>o.type==='message'&&o.content.some(c=>c.type==='refusal')))throw new SafeError(422,'refusal','The service could not create this example. Your current transcript is unchanged.');
      let raw:unknown;try{raw=JSON.parse(response.output_text);}catch{throw new InvalidReview('example_json');}
      return validateExample(raw,scenario,variation);
    }catch(e){
      if(signal.aborted)throw new SafeError(504,'timeout','Example generation timed out or was cancelled. Your current transcript is unchanged.');
      if(e instanceof InvalidReview){correction=e.code;if(attempt===0)continue;throw new SafeError(502,'example_validation','The generated example did not meet the length or speaker requirements. Your current transcript is unchanged; please try again later.');}
      if(e instanceof SafeError)throw e;
      throw new SafeError(502,'provider','The service could not create an example. Your current transcript is unchanged; please try again later.');
    }
  }
  throw new SafeError(502,'example_validation','The example could not be checked.');
}

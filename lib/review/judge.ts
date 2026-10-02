import OpenAI from 'openai';
import { Agent, fetch as undiciFetch } from 'undici';
import type { ResponseCreateParamsNonStreaming, Response } from 'openai/resources/responses/responses';
import { SYSTEM_PROMPT } from './prompt';
import { REVIEW_JSON_SCHEMA, InvalidReview, makeReview } from './schema';
import { MAX_OUTPUT_TOKENS, MAX_PROMPT_BYTES, REVIEW_TIMEOUT_MS } from '../constants';
import rubric from '../rubric.json';
import type { PreparedInput } from './input';
import type { Config } from '../server/config';
import { SafeError } from '../server/errors';
export type Provider=(params:ResponseCreateParamsNonStreaming,signal:AbortSignal)=>Promise<Pick<Response,'status'|'output'|'output_text'|'usage'>>;
export function createProvider(key:string,timeout=REVIEW_TIMEOUT_MS):Provider {
  return async (params,signal)=>{
    // Request-local transport: match the SDK, headers and body timeouts; release sockets
    // after every attempt rather than retaining request-associated transport state.
    const dispatcher=new Agent({headersTimeout:timeout,bodyTimeout:timeout});
    const client=new OpenAI({apiKey:key,baseURL:'https://api.openai.com/v1',maxRetries:0,timeout,logLevel:'off',fetch:undiciFetch as unknown as typeof fetch,fetchOptions:{dispatcher}});
    try{return await client.responses.create(params,{signal,maxRetries:0,timeout});}
    finally{await dispatcher.destroy();}
  };
}
export function requestParameters(prepared:PreparedInput,config:Pick<Config,'model'|'effort'>,correction?:string):ResponseCreateParamsNonStreaming {
  return {model:config.model,reasoning:{effort:config.effort},service_tier:'default',store:false,background:false,max_output_tokens:MAX_OUTPUT_TOKENS,
    instructions:SYSTEM_PROMPT+`\nTrusted rubric:\n${JSON.stringify(rubric)}${correction?`\nPrevious output failed application validation: ${correction}. Produce a complete corrected review.`:''}`,
    input:[{role:'user',content:JSON.stringify({roles:prepared.input.roles,meetingContext:prepared.input.context,computedMetrics:prepared.metrics,untrustedTranscriptSegments:prepared.parsed.segments})}],
    text:{format:{type:'json_schema',name:'meeting_coach_review_v2',strict:true,schema:REVIEW_JSON_SCHEMA}}};
}
export async function judge(prepared:PreparedInput,config:Pick<Config,'model'|'effort'|'timeout'>,provider:Provider,reserve:()=>Promise<void>,parent:AbortSignal){
  const deadline=AbortSignal.timeout(config.timeout);const signal=AbortSignal.any([parent,deadline]);let correction:string|undefined;
  for(let attempt=0;attempt<2;attempt++){
    const params=requestParameters(prepared,config,correction);
    if(Buffer.byteLength(JSON.stringify(params),'utf8')>MAX_PROMPT_BYTES)throw new SafeError(413,'tokens','This transcript exceeds the review input budget. Use a shorter excerpt.');
    try {
      signal.throwIfAborted();await reserve();signal.throwIfAborted();
      const response=await abortable(provider(params,signal),signal);
      if(response.status!=='completed')throw new SafeError(502,'incomplete','The model did not finish a complete review. Try a shorter excerpt.');
      if(response.output.some(o=>o.type==='message'&&o.content.some(c=>c.type==='refusal')))throw new SafeError(422,'refusal','The model could not review this transcript. Try an appropriate excerpt.');
      let raw:unknown;try{raw=JSON.parse(response.output_text);}catch{throw new InvalidReview('invalid_json');}
      return {review:makeReview(raw,prepared.parsed.segments,prepared.input.context,prepared.metrics,config.model),usage:response.usage,attempts:attempt+1};
    }catch(e){
      if(signal.aborted)throw new SafeError(504,'timeout','The review timed out or was cancelled. Your transcript is still here. Try a shorter excerpt.');
      if(e instanceof InvalidReview){correction=e.code;if(attempt===0)continue;throw new SafeError(502,'validation','The review could not be verified against your transcript. Your input is still here; please try again later.');}
      if(e instanceof SafeError)throw e;
      throw new SafeError(502,'provider','The review service could not complete the request. Your transcript is still here; please try again later.');
    }
  }
  throw new SafeError(502,'validation','The review could not be verified.');
}
export async function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();let handler:()=>void=()=>{};
  try{return await Promise.race([promise,new Promise<never>((_,reject)=>{handler=()=>reject(new Error('aborted'));signal.addEventListener('abort',handler,{once:true});})]);}
  finally{signal.removeEventListener('abort',handler);}
}

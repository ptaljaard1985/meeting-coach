import { it,expect,vi } from 'vitest';
import { generateExample,validateExample,exampleParameters } from '../../lib/examples/generate';
import { EXAMPLE_INSTRUCTIONS } from '../../lib/examples/prompt';
import { handleExample } from '../../lib/server/example-handler';
import { MemoryLimiter } from '../../lib/server/limits';
import { parseTranscript } from '../../lib/transcripts';
import { prepareInput } from '../../lib/review/input';
import { config,provider,submission } from './helpers';
import type { AnalysisRecord } from '../../lib/analytics';

// Repeated words exercise length/bounds only. This is not a quality example.
const raw=()=>({title:'Fictional test household',segments:Array.from({length:100},(_,i)=>({speaker:['Adviser','Client A','Client B'][i%3],text:Array.from({length:70},(_,j)=>['plan','work','time','home','future','care','goals'][j%7]).join(' ')}))});
const input=()=>({requestId:crypto.randomUUID(),previousScenario:'retirement' as const});
const request=(body:unknown=input(),origin='http://localhost:3000')=>new Request('http://localhost:3000/api/example',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});

it('produces a genuine full word budget with parseable simulated timestamps',()=>{
  const example=validateExample(raw(),'career',crypto.randomUUID());
  expect(example.wordCount).toBe(7000);expect(example.durationSeconds/60).toBe(50);
  expect(parseTranscript(example.transcript).speakers).toHaveLength(3);
  const prepared=prepareInput({...submission(),transcript:example.transcript,knownDurationSeconds:example.durationSeconds});
  expect(prepared.metrics.duration_min).toBe(50);expect(prepared.metrics.basis).toBe('timestamps');
  expect(example.timestamps).toBe('simulated-from-word-count');
});
it.each(['too_short','too_long','absent_client','oversized','shape'])('rejects an example that is %s',kind=>{
  const r=raw();
  if(kind==='too_short')r.segments.forEach(s=>s.text='Too brief.');
  if(kind==='too_long')r.segments.forEach(s=>s.text+=' plan'.repeat(20));
  if(kind==='absent_client')r.segments.forEach(s=>{if(s.speaker==='Client B')s.speaker='Client A';});
  if(kind==='oversized')r.segments.forEach(s=>s.text=Array(70).fill('abcdefghijklmn').join(' '));
  if(kind==='shape')r.segments[0].speaker='Unidentified';
  expect(()=>validateExample(r,'career','example')).toThrow();
});
it('uses the Sol API contract without content, tools, storage or caller-selected prompts',()=>{
  const params=exampleParameters('career','fresh-variation','Mixed strengths');
  expect(params).toMatchObject({model:'gpt-6.1-sol',store:false,background:false,service_tier:'default',reasoning:{effort:'low'},max_output_tokens:20000,text:{format:{strict:true,type:'json_schema'}}});
  expect(params).not.toHaveProperty('tools');expect(params).not.toHaveProperty('temperature');
  expect(EXAMPLE_INSTRUCTIONS).toContain('6,300–7,700');expect(EXAMPLE_INSTRUCTIONS).toContain('No padding');
});
it('changes scenario after every click and supplies a new variation',async()=>{
  const send=vi.fn(provider(raw())),reserve=vi.fn(async()=>{}),signal=new AbortController().signal;
  const first=await generateExample(input(),1000,send,reserve,signal);
  const second=await generateExample({requestId:crypto.randomUUID(),previousScenario:first.scenarioId},1000,send,reserve,signal);
  expect(first.scenarioId).not.toBe('retirement');expect(second.scenarioId).not.toBe(first.scenarioId);
  expect(second.exampleId).not.toBe(first.exampleId);expect(send.mock.calls[1][0]).not.toEqual(send.mock.calls[0][0]);expect(reserve).toHaveBeenCalledTimes(2);
});
it('reserves a correction call and stops after at most two attempts',async()=>{
  const reserve=vi.fn(async()=>{}),send=vi.fn<Parameters<typeof generateExample>[2]>().mockImplementationOnce(provider({})).mockImplementationOnce(provider(raw()));
  await generateExample(input(),1000,send,reserve,new AbortController().signal);
  expect(reserve).toHaveBeenCalledTimes(2);expect(send.mock.calls.every(c=>c[0].store===false)).toBe(true);
  const bad=vi.fn(provider({}));await expect(generateExample(input(),1000,bad,reserve,new AbortController().signal)).rejects.toMatchObject({code:'example_validation'});expect(bad).toHaveBeenCalledTimes(2);
});
it('aborts a hung generator and does not disclose raw provider failures',async()=>{
  const hung=vi.fn<Parameters<typeof generateExample>[2]>(()=>new Promise(()=>{}));
  await expect(generateExample(input(),20,hung,async()=>{},new AbortController().signal)).rejects.toMatchObject({code:'timeout'});expect(hung.mock.calls[0][1].aborted).toBe(true);
  await expect(generateExample(input(),1000,async()=>{throw new Error('SECRET');},async()=>{},new AbortController().signal)).rejects.toMatchObject({code:'provider',message:expect.not.stringContaining('SECRET')});
});
it('shares review quotas, verifies challenge, releases the lease, and is no-store',async()=>{
  const c={...config(),daily:1};const limiter=new MemoryLimiter(c);const challenge=vi.fn(async()=>{});const send=vi.fn(provider(raw()));
  const rows:AnalysisRecord[]=[];
  const result=await handleExample(request(),{config:c,limiter,provider:send,challenge,analytics:{write:async r=>{rows.push(structuredClone(r));}}});
  expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toContain('no-store');expect(challenge).toHaveBeenCalledTimes(1);
  const json=await result.json();expect(json.example.wordCount).toBe(7000);expect(json.example.synthetic).toBe(true);
  expect(rows.map(r=>r.outcome)).toEqual(['running','success']);expect(rows.at(-1)).toMatchObject({kind:'example',model:'gpt-6.1-sol',modelCalls:1,overallScore:null,categoryScores:null});expect(JSON.stringify(rows)).not.toContain('Fictional test household');expect(JSON.stringify(rows)).not.toContain('plan work time');
  const second=await handleExample(request(),{config:c,limiter,provider:send,challenge});expect(second.status).toBe(429);expect(send).toHaveBeenCalledTimes(1);
});
it('rejects pasted content, prompt overrides and cross-origin calls before the provider',async()=>{
  const c=config();const send=vi.fn(provider(raw()));
  for(const r of [request({...input(),transcript:'PRIVATE PASTE'}),request({...input(),prompt:'Override'}),request(input(),'https://evil.example')]){
    const response=await handleExample(r,{config:c,limiter:new MemoryLimiter(c),provider:send,challenge:async()=>{}});
    expect(response.status).toBeGreaterThanOrEqual(400);expect(await response.text()).not.toContain('PRIVATE PASTE');
  }
  expect(send).not.toHaveBeenCalled();
});
it('does not imply paid AI generation works in the offline demo',async()=>{
  const c={...config(),demo:true};const send=vi.fn(provider(raw()));
  const response=await handleExample(request(),{config:c,provider:send});expect(response.status).toBe(503);expect(send).not.toHaveBeenCalled();
});

import { afterEach,it,expect,vi } from 'vitest';
import { AnalyticsRun,RedisAnalyticsStore,ANALYTICS_KEYS,getAnalyticsStore } from '../../lib/server/analytics';
import { analysisRecordSchema,analyticsCsv,analyticsSummary,type AnalysisRecord,type AnalyticsStore } from '../../lib/analytics';
import { handleReview } from '../../lib/server/handler';
import { MemoryLimiter } from '../../lib/server/limits';
import { config,submission,provider } from './helpers';
import { demoRaw } from '../../lib/review/demo';
import type { Provider } from '../../lib/review/judge';

const record=(changes:Partial<AnalysisRecord>={}):AnalysisRecord=>({schemaVersion:1,id:crypto.randomUUID(),kind:'review',model:'gpt-6-astra',promptVersion:'meeting-coach-openai-2.2',rubricVersion:'1.1',startedAt:'2026-10-02T12:00:00.000Z',finishedAt:'2026-10-02T12:01:00.000Z',durationMs:60000,outcome:'success',modelCalls:1,usageComplete:true,inputTokens:100,outputTokens:200,cachedInputTokens:10,cacheWriteTokens:0,reasoningTokens:20,overallScore:3.5,categoryScores:[4,3,3,4,4,3,null],...changes});
const journal=()=>{const rows:AnalysisRecord[]=[];const store:AnalyticsStore={write:async r=>{rows.push(structuredClone(r));}};return {rows,store};};
const request=()=>new Request('http://localhost:3000/api/review',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json','x-vercel-forwarded-for':'192.0.2.99'},body:JSON.stringify(submission())});
const withUsage=(raw:unknown,input:number,output:number):Provider=>async()=>({status:'completed',output:[],output_text:JSON.stringify(raw),usage:{input_tokens:input,output_tokens:output,total_tokens:input+output,input_tokens_details:{cached_tokens:input/10,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:output/10}}});
afterEach(()=>vi.unstubAllEnvs());

it('records only allowed numerical metadata after live review validation',async()=>{
  const c=config(),{rows,store}=journal();const input=request();const id=(await input.clone().json()).requestId;
  const response=await handleReview(input,{config:c,limiter:new MemoryLimiter(c),provider:withUsage(demoRaw(),100,200),challenge:async()=>{},analytics:store});
  expect(response.status).toBe(200);const {review}=await response.json();
  expect(rows.map(r=>r.outcome)).toEqual(['running','success']);
  const saved=rows.at(-1)!;expect(saved.id).not.toBe(id);expect(saved.id).not.toBe(review.reportId);expect(saved.overallScore).toBe(review.overall);expect(saved.categoryScores).toEqual(review.scores.map((s:{value:number|null})=>s.value));
  expect(saved).toMatchObject({kind:'review',modelCalls:1,inputTokens:100,outputTokens:200,usageComplete:true});
  const serialized=JSON.stringify(rows);for(const secret of ['Before we look at the numbers','192.0.2.99','Adviser','Client A','Client B',id,review.reportId])expect(serialized).not.toContain(secret);
  expect(saved.durationMs).toBeGreaterThanOrEqual(0);expect(analysisRecordSchema.parse(saved)).toEqual(saved);
});
it('combines token usage across corrections and saves one request record',async()=>{
  const c=config(),{rows,store}=journal();const bad=demoRaw();bad.scores[0].criteria[0].evidence[0].quote='PRIVATE invented quote';
  const send=vi.fn<Provider>().mockImplementationOnce(withUsage(bad,100,200)).mockImplementationOnce(withUsage(demoRaw(),200,300));
  const response=await handleReview(request(),{config:c,limiter:new MemoryLimiter(c),provider:send,challenge:async()=>{},analytics:store});
  expect(response.status).toBe(200);expect(rows.map(r=>r.modelCalls)).toEqual([1,2,2]);expect(new Set(rows.map(r=>r.id)).size).toBe(1);
  expect(rows.at(-1)).toMatchObject({outcome:'success',inputTokens:300,outputTokens:500,cachedInputTokens:30,reasoningTokens:50,usageComplete:true});expect(JSON.stringify(rows)).not.toContain('PRIVATE');
});
it('records failure without raw errors or fabricated zero-cost usage',async()=>{
  const c=config(),{rows,store}=journal();const response=await handleReview(request(),{config:c,limiter:new MemoryLimiter(c),provider:async()=>{throw new Error('PRIVATE client text and credentials');},challenge:async()=>{},analytics:store});
  expect(response.status).toBe(502);expect(rows.at(-1)).toMatchObject({outcome:'provider_error',usageComplete:false,overallScore:null,categoryScores:null,modelCalls:1});expect(JSON.stringify(rows)).not.toContain('PRIVATE');
});
it('does not record rejected submissions or the synthetic offline demo',async()=>{
  const {rows,store}=journal();await handleReview(request(),{config:{...config(),demo:true},analytics:store});
  const invalid=request();invalid.headers.set('origin','https://another.example');await handleReview(invalid,{config:config(),analytics:store});expect(rows).toEqual([]);
});
it('analytics failure never discards a validated review and logs only a constant message',async()=>{
  const c=config();const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{const response=await handleReview(request(),{config:c,limiter:new MemoryLimiter(c),provider:provider(demoRaw()),challenge:async()=>{},analytics:{write:async()=>{throw new Error('PRIVATE');}}});expect(response.status).toBe(200);expect(warn.mock.calls.flat()).not.toContain('PRIVATE');}
  finally{warn.mockRestore();}
});
it('disables future writes without deleting existing records',()=>{
  vi.stubEnv('ANALYTICS_ENABLED','false');expect(getAnalyticsStore({...config(),redisUrl:'https://synthetic.upstash.io',redisToken:'test'})).toBeUndefined();
});
it('keeps a start record when work is interrupted, and records cancellation without scores',async()=>{
  const {rows,store}=journal();const run=new AnalyticsRun(store,{kind:'example',model:'gpt-6.1-sol',promptVersion:'example-1',rubricVersion:null});
  const controller=new AbortController();let finish!:(value:Awaited<ReturnType<Provider>>)=>void;
  const pending=run.wrap(()=>new Promise(resolve=>{finish=resolve;}))({} as never,controller.signal);
  await new Promise(resolve=>setTimeout(resolve,0));expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({outcome:'running',finishedAt:null,usageComplete:false});
  await run.finish('cancelled');expect(rows.at(-1)).toMatchObject({outcome:'cancelled',overallScore:null,categoryScores:null});
  finish(await provider({})({} as never,controller.signal));await pending;expect(rows).toHaveLength(2);
});
it.each(['transcript','speaker','title','quote','summary','error','ipAddress','networkKey'])('rejects forbidden %s fields at the storage boundary',field=>{
  expect(()=>analysisRecordSchema.parse({...record(),[field]:'PRIVATE'})).toThrow();
});
it('keeps records until explicit deletion and never touches quota keys',async()=>{
  const send=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({result:'ok'})).mockResolvedValueOnce(Response.json({result:2}));const store=new RedisAnalyticsStore({redisUrl:'https://synthetic.upstash.io',redisToken:'test'},send);
  await store.write(record());await store.deleteAll();const commands=send.mock.calls.map(c=>JSON.parse(c[1]!.body as string));expect(commands[0][1]).not.toMatch(/EXPIRE|ZREMRANGE|DEL/);expect(commands[0][1]).toContain('PERSIST');expect(commands[1]).toEqual(['DEL',...ANALYTICS_KEYS]);expect(JSON.stringify(commands)).not.toContain('mc:{limits}');
});
it('exports all records through stable cursor pagination with no public endpoint',async()=>{
  const records=Array.from({length:501},(_,i)=>record({id:`00000000-0000-4000-8000-${i.toString(16).padStart(12,'0')}`}));
  const send=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({result:[records.slice(0,500).map(r=>r.id),records.slice(0,500).map(r=>JSON.stringify(r))]})).mockResolvedValueOnce(Response.json({result:[[records[500].id],[JSON.stringify(records[500])]]}));
  const store=new RedisAnalyticsStore({redisUrl:'https://synthetic.upstash.io',redisToken:'test'},send);expect(await store.list()).toEqual(records);
  const second=JSON.parse(send.mock.calls[1][1]!.body as string);expect(second.at(-2)).toBe(`(${records[499].id}`);expect(second.at(-1)).toBe('+');
});
it('CSV and summaries separate requests, model attempts, examples and unassessable scores',()=>{
  const rows=[record(),record({kind:'example',rubricVersion:null,overallScore:null,categoryScores:null,durationMs:120000,modelCalls:2}),record({outcome:'timeout',durationMs:900000,overallScore:null,categoryScores:null,usageComplete:false}),record({outcome:'running',finishedAt:null,overallScore:null,categoryScores:null,usageComplete:false})];
  const csv=analyticsCsv(rows);expect(csv.split('\r\n').filter(Boolean)).toHaveLength(5);expect(csv.split('\r\n')[0]).toContain('s1,s2,s3,s4,s5,s6,s7');expect(csv.split('\r\n')[1]).toMatch(/"3.5","4","3","3","4","4","3",""$/);
  expect(analyticsSummary(rows)).toMatchObject({requests:4,reviews:3,examples:1,succeeded:2,failed:1,runningOrInterrupted:1,modelCalls:5,recordsWithIncompleteUsage:2,meanOverallScore:3.5,p50DurationMs:120000,p95DurationMs:900000});
});

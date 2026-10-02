import { analysisRecordSchema,getAnalyticsSettings,type AnalysisRecord,type AnalysisOutcome,type AnalyticsStore } from '../analytics';
import type { Config } from './config';
import type { Provider } from '../review/judge';
import type { Review } from '../types';
import rubric from '../rubric.json';

// No expiry and no automatic eviction: the operator chose retention until deletion.
export const ANALYTICS_KEYS=['mc:{analytics}:index','mc:{analytics}:records'] as const;
export const WRITE_ANALYTICS_SCRIPT=`
redis.call('HSET',KEYS[2],ARGV[1],ARGV[3]);
redis.call('ZADD',KEYS[1],'NX',ARGV[2],ARGV[1]);
redis.call('PERSIST',KEYS[1]); redis.call('PERSIST',KEYS[2]);
return 'ok'`;
export const READ_ANALYTICS_SCRIPT=`
local ids=redis.call('ZRANGE',KEYS[1],ARGV[1],ARGV[2],'BYLEX','LIMIT',0,500);
local rows={};
for _,id in ipairs(ids) do
  local value=redis.call('HGET',KEYS[2],id);
  if value then table.insert(rows,value) end
end
return {ids,rows}`;

export class RedisAnalyticsStore implements AnalyticsStore {
  constructor(private config:Pick<Config,'redisUrl'|'redisToken'>,private send:typeof fetch=fetch){}
  private async command(command:unknown[]){
    const url=this.config.redisUrl;
    if(!url||!this.config.redisToken)throw new Error('Analytics Redis is not configured.');
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.upstash.io')||parsed.pathname!=='/')throw new Error('Invalid analytics Redis destination.');
    const response=await this.send(url,{method:'POST',headers:{Authorization:`Bearer ${this.config.redisToken}`,'Content-Type':'application/json'},
      body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw new Error('Analytics Redis unavailable.');
    const result=await response.json() as {result?:unknown;error?:unknown};
    if(result.error||result.result===undefined)throw new Error('Analytics Redis rejected the operation.');
    return result.result;
  }
  async write(record:AnalysisRecord){
    const r=analysisRecordSchema.parse(record);
    // All index scores are zero so lexicographic pagination remains stable during writes.
    const result=await this.command(['EVAL',WRITE_ANALYTICS_SCRIPT,2,...ANALYTICS_KEYS,r.id,0,JSON.stringify(r)]);
    if(result!=='ok')throw new Error('Analytics write failed.');
  }
  async list(){
    const records:AnalysisRecord[]=[];let after='-';
    while(true){
      const result=await this.command(['EVAL',READ_ANALYTICS_SCRIPT,2,...ANALYTICS_KEYS,after,'+']);
      if(!Array.isArray(result)||result.length!==2||!Array.isArray(result[0])||!Array.isArray(result[1]))throw new Error('Invalid analytics export response.');
      const [ids,rows]=result as [unknown[],unknown[]];
      if(ids.length>500||rows.length>500||ids.some(id=>typeof id!=='string'||!analysisRecordSchema.shape.id.safeParse(id).success))throw new Error('Invalid analytics export page.');
      for(const raw of rows){if(typeof raw!=='string')throw new Error('Invalid analytics export record.');records.push(analysisRecordSchema.parse(JSON.parse(raw)));}
      if(ids.length<500)break;
      const next=`(${ids.at(-1)}`;
      if(next===after)throw new Error('Analytics export did not advance.');
      after=next;
    }
    return records.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.id.localeCompare(b.id));
  }
  async deleteAll(){return this.command(['DEL',...ANALYTICS_KEYS]);}
}
export function getAnalyticsStore(config:Config){
  if(!getAnalyticsSettings().enabled||!config.redisUrl||!config.redisToken)return undefined;
  return new RedisAnalyticsStore(config);
}

export class AnalyticsRun {
  private id=crypto.randomUUID();private startedAt:string;private start:number;
  private calls=0;private returnedUsage=0;private input=0;private output=0;private cached=0;private cacheWrites=0;private reasoning=0;
  constructor(private store:AnalyticsStore|undefined,private context:Pick<AnalysisRecord,'kind'|'model'|'promptVersion'|'rubricVersion'>,timing={at:new Date().toISOString(),tick:performance.now()}){this.startedAt=timing.at;this.start=timing.tick;}
  wrap(provider:Provider):Provider{return async(params,signal)=>{
    this.calls++;await this.persist('running');signal.throwIfAborted();
    const response=await provider(params,signal);
    // Read only numerical usage; never pass a provider response or its output to storage.
    const u=response.usage;
    if(u&&[u.input_tokens,u.output_tokens,u.input_tokens_details?.cached_tokens,u.input_tokens_details?.cache_write_tokens,u.output_tokens_details?.reasoning_tokens].every(n=>Number.isSafeInteger(n)&&n>=0)){
      this.returnedUsage++;this.input+=u.input_tokens;this.output+=u.output_tokens;this.cached+=u.input_tokens_details.cached_tokens;this.cacheWrites+=u.input_tokens_details.cache_write_tokens;this.reasoning+=u.output_tokens_details.reasoning_tokens;
    }
    return response;
  };}
  async finish(outcome:Exclude<AnalysisOutcome,'running'>,review?:Review){await this.persist(outcome,review);}
  private async persist(outcome:AnalysisOutcome,review?:Review){
    if(!this.store||!this.calls)return;
    const done=outcome!=='running';
    // Project individual allowed fields, never spread input/review/provider objects.
    const record:AnalysisRecord={schemaVersion:1,id:this.id,...this.context,startedAt:this.startedAt,finishedAt:done?new Date().toISOString():null,
      durationMs:Math.round(performance.now()-this.start),outcome,modelCalls:this.calls,usageComplete:this.returnedUsage===this.calls,
      inputTokens:this.input,outputTokens:this.output,cachedInputTokens:this.cached,cacheWriteTokens:this.cacheWrites,reasoningTokens:this.reasoning,
      overallScore:outcome==='success'&&review?review.overall:null,
      categoryScores:outcome==='success'&&review?rubric.scores.map(s=>review.scores.find(r=>r.score_id===s.id)?.value??null):null};
    try{await this.store.write(analysisRecordSchema.parse(record));}
    catch{console.warn('Meeting Coach numerical analytics could not be saved.');}
  }
}
export function analyticsFailure(code:string,cancelled:boolean):Exclude<AnalysisOutcome,'running'|'success'>{
  if(cancelled)return 'cancelled';
  if(code==='timeout')return 'timeout';
  if(code==='provider')return 'provider_error';
  if(code==='validation'||code==='example_validation')return 'validation_error';
  if(code==='incomplete'||code==='refusal')return code;
  return 'other_error';
}

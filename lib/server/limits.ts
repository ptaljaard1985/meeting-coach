import { createHmac } from 'node:crypto';
import type { Config } from './config';
import { SafeError, unavailable } from './errors';
export interface Limiter { begin(id:string,network:string):Promise<void>; reserve(id:string,network:string):Promise<void>; release(id:string):Promise<void> }
const denial=(code:string)=>{if(code==='daily')return new SafeError(429,code,'Today’s AI request allowance has been reached. Please return tomorrow.');if(code==='duplicate')return new SafeError(409,code,'This submission was already accepted. Wait for it to finish, or start a new request.');return new SafeError(429,code,'AI requests are busy or this network has reached its allowance. Please try again later.');};
// All decisions and increments for an operation are one Redis EVAL, across instances.
// Redis TIME avoids instance-clock skew. IDs are opaque, no content fingerprints.
export const BEGIN_SCRIPT=`
local t=redis.call('TIME'); local now=tonumber(t[1]);
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now);
if redis.call('EXISTS',KEYS[2])==1 then return 'duplicate' end
if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[1]) then return 'busy' end
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',now-3600);
redis.call('ZREMRANGEBYSCORE',KEYS[4],'-inf',now-3600);
if redis.call('ZCARD',KEYS[3])>=tonumber(ARGV[4]) then return 'network' end
if redis.call('ZCARD',KEYS[4])>=300 then return 'busy' end
redis.call('ZADD',KEYS[3],now,ARGV[3]); redis.call('EXPIRE',KEYS[3],7200);
redis.call('ZADD',KEYS[4],now,ARGV[3]); redis.call('EXPIRE',KEYS[4],7200);
redis.call('SET',KEYS[2],'1','EX',86400,'NX');
redis.call('ZADD',KEYS[1],now+tonumber(ARGV[2]),ARGV[3]); redis.call('EXPIRE',KEYS[1],tonumber(ARGV[2])+60);
return 'ok'`;
export const RESERVE_SCRIPT=`
local t=redis.call('TIME'); local now=tonumber(t[1]);
local lease=redis.call('ZSCORE',KEYS[1],ARGV[1]);
if not lease or tonumber(lease)<=now then return 'busy' end
local dayStart=math.floor(now/86400)*86400;
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf','('..dayStart);
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',now-3600);
if redis.call('ZCARD',KEYS[2])>=tonumber(ARGV[2]) then return 'daily' end
if redis.call('ZCARD',KEYS[3])>=tonumber(ARGV[3]) then return 'network' end
redis.call('ZADD',KEYS[2],now,ARGV[4]); redis.call('EXPIRE',KEYS[2],172800);
redis.call('ZADD',KEYS[3],now,ARGV[4]); redis.call('EXPIRE',KEYS[3],7200);
return 'ok'`;
// Fixed keys and Redis time prevent clock-skew/day-boundary quota bypass.
export class RedisLimiter implements Limiter {
  constructor(private config:Config,private send:typeof fetch=fetch){}
  private async eval(script:string,keys:string[],args:(string|number)[]){
    try {const response=await this.send(this.config.redisUrl!,{method:'POST',headers:{Authorization:`Bearer ${this.config.redisToken}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,keys.length,...keys,...args.map(String)]),cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw unavailable();const result=await response.json();if(typeof result.result!=='string')throw unavailable();if(result.result!=='ok')throw denial(result.result);
    }catch(e){if(e instanceof SafeError)throw e;throw unavailable();}
  }
  begin(id:string,network:string){return this.eval(BEGIN_SCRIPT,['mc:{limits}:leases',`mc:{limits}:request:${id}`,`mc:{limits}:submits:${network}`,'mc:{limits}:submits:all'],[this.config.concurrency,Math.ceil(this.config.timeout/1000)+30,id,this.config.hourly*2]);}
  reserve(id:string,network:string){return this.eval(RESERVE_SCRIPT,['mc:{limits}:leases','mc:{limits}:daily',`mc:{limits}:calls:${network}`],[id,this.config.daily,this.config.hourly,crypto.randomUUID()]);}
  async release(id:string){await this.eval("redis.call('ZREM',KEYS[1],ARGV[1]); return 'ok'",['mc:{limits}:leases'],[id]);}
}
// Local development only; only counters and opaque IDs are held in module scope.
export class MemoryLimiter implements Limiter {
  private requests=new Map<string,number>();private leases=new Map<string,number>();private counts=new Map<string,{n:number;until:number}>();
  constructor(private config:Pick<Config,'daily'|'hourly'|'concurrency'|'timeout'>,private now=()=>Date.now()){}
  private prune(){const now=this.now();for(const [k,v] of this.requests)if(v<=now)this.requests.delete(k);for(const [k,v] of this.leases)if(v<=now)this.leases.delete(k);for(const [k,v] of this.counts)if(v.until<=now)this.counts.delete(k);}
  async begin(id:string,network:string){this.prune();const now=this.now(),key=`submit:${network}:${Math.floor(now/3600000)}`;
    if(this.requests.has(id))throw denial('duplicate');if(this.leases.size>=this.config.concurrency)throw denial('busy');if((this.counts.get(key)?.n??0)>=this.config.hourly*2)throw denial('network');
    this.counts.set(key,{n:(this.counts.get(key)?.n??0)+1,until:now+7200000});this.requests.set(id,now+86400000);this.leases.set(id,now+this.config.timeout+30000);
  }
  async reserve(id:string,network:string){this.prune();const now=this.now();if(!this.leases.has(id))throw denial('busy');const day=`day:${Math.floor(now/86400000)}`,hour=`hour:${network}:${Math.floor(now/3600000)}`;
    if((this.counts.get(day)?.n??0)>=this.config.daily)throw denial('daily');if((this.counts.get(hour)?.n??0)>=this.config.hourly)throw denial('network');
    this.counts.set(day,{n:(this.counts.get(day)?.n??0)+1,until:now+172800000});this.counts.set(hour,{n:(this.counts.get(hour)?.n??0)+1,until:now+7200000});
  }
  async release(id:string){this.leases.delete(id);}
}
let local:MemoryLimiter|undefined;
export function getLimiter(config:Config){if(config.redisUrl&&config.redisToken)return new RedisLimiter(config);if(config.production)throw unavailable();return local??=new MemoryLimiter(config);}
export function networkKey(request:Request,config:Config){
  const address=config.ipHeader?request.headers.get(config.ipHeader)?.split(',')[0].trim():undefined;
  if(config.production&&!address)throw unavailable();
  return createHmac('sha256',config.limitSecret).update(`${request.headers.get('origin')}|${address??'local'}|${Math.floor(Date.now()/86400000)}`).digest('hex');
}

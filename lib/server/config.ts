import { SafeError, unavailable } from './errors';
import { REVIEW_TIMEOUT_MS } from '../constants';
export function getConfig(env:NodeJS.ProcessEnv=process.env) {
  const production=env.NODE_ENV==='production'; const demo=env.REVIEW_MODE!=='live';
  const integer=(key:string,fallback:number,min:number,max:number)=>{const n=Number(env[key]??fallback);if(!Number.isInteger(n)||n<min||n>max)throw unavailable();return n;};
  const model=env.REVIEW_MODEL??'gpt-6-astra';const effort=env.REVIEW_REASONING_EFFORT??'medium';
  if(!['gpt-6-astra','gpt-6.1-sol'].includes(model)||!['low','medium','high','xhigh','max'].includes(effort))throw unavailable();
  const origin=env.APP_ORIGIN;
  if(production&&!demo){
    if(!env.OPENAI_API_KEY||!origin||!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY||!env.UPSTASH_REDIS_REST_URL||!env.UPSTASH_REDIS_REST_TOKEN||!env.LIMIT_KEY_SECRET||env.LIMIT_KEY_SECRET.length<32||!env.TRUSTED_IP_HEADER)throw unavailable();
    try {const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw unavailable();const r=new URL(env.UPSTASH_REDIS_REST_URL);if(r.protocol!=='https:'||!r.hostname.endsWith('.upstash.io')||r.pathname!=='/')throw unavailable();}catch{throw unavailable();}
  }
  if(!demo&&!env.OPENAI_API_KEY)throw new SafeError(503,'missing_key','Live reviews need the operator’s API configuration. Try the synthetic demo or return later.');
  return {production,demo,model,effort:effort as 'low'|'medium'|'high'|'xhigh'|'max',origin,
    daily:integer('REVIEW_DAILY_CALL_LIMIT',30,1,1000),hourly:integer('REVIEW_NETWORK_HOURLY_CALL_LIMIT',12,1,100),concurrency:integer('REVIEW_CONCURRENCY',3,1,20),timeout:integer('REVIEW_TIMEOUT_MS',REVIEW_TIMEOUT_MS,1000,REVIEW_TIMEOUT_MS),
    redisUrl:env.UPSTASH_REDIS_REST_URL,redisToken:env.UPSTASH_REDIS_REST_TOKEN,limitSecret:env.LIMIT_KEY_SECRET??'local-development-only',ipHeader:env.TRUSTED_IP_HEADER,
    challengeSecret:env.TURNSTILE_SECRET_KEY,siteKey:env.TURNSTILE_SITE_KEY};
}
export type Config=ReturnType<typeof getConfig>;

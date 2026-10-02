import { readBoundedJson } from './body';
import { getConfig, type Config } from './config';
import { prepareInput } from '../review/input';
import { demoReview } from '../review/demo';
import { judge, createProvider, type Provider } from '../review/judge';
import { getLimiter, networkKey, type Limiter } from './limits';
import { verifyChallenge } from './challenge';
import { SafeError } from './errors';
import { AnalyticsRun,analyticsFailure,getAnalyticsStore } from './analytics';
import type { AnalyticsStore } from '../analytics';
import { PROMPT_VERSION } from '../constants';
import rubric from '../rubric.json';
export const RESPONSE_HEADERS={'Cache-Control':'no-store, max-age=0','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
interface Dependencies {config?:Config;limiter?:Limiter;provider?:Provider;challenge?:typeof verifyChallenge;analytics?:AnalyticsStore}
export async function handleReview(request:Request,deps:Dependencies={}){
  const timing={at:new Date().toISOString(),tick:performance.now()};
  let limiter:Limiter|undefined;let id:string|undefined;
  let analytics:AnalyticsRun|undefined;
  try{
    const config=deps.config??getConfig();const requestOrigin=new URL(request.url).origin;
    const expected=config.origin??requestOrigin;
    if(request.headers.get('origin')!==expected || request.headers.get('sec-fetch-site')==='cross-site')throw new SafeError(403,'origin','Open Meeting Coach in its own browser tab and try again.');
    const raw=await readBoundedJson(request);let prepared;
    try{prepared=prepareInput(raw);}catch{throw new SafeError(400,'input','Check the speaker labels, roles, meeting context, duration and responsibility acknowledgement. Unsupported or incomplete attribution cannot be reviewed.');}
    if(config.demo)return Response.json({review:demoReview(prepared)},{headers:RESPONSE_HEADERS});
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(config.timeout)]);
    limiter=deps.limiter??getLimiter(config);const network=networkKey(request,config);await limiter.begin(prepared.input.requestId,network);id=prepared.input.requestId;
    await (deps.challenge??verifyChallenge)(prepared.input.challengeToken,{...config,origin:expected},signal);
    analytics=new AnalyticsRun(deps.analytics??getAnalyticsStore(config),{kind:'review',model:config.model as 'gpt-6-astra'|'gpt-6.1-sol',promptVersion:PROMPT_VERSION,rubricVersion:rubric.rubric_version},timing);
    const outcome=await judge(prepared,config,analytics.wrap(deps.provider??createProvider(process.env.OPENAI_API_KEY!,config.timeout)),()=>limiter!.reserve(id!,network),signal);
    await analytics.finish('success',outcome.review);
    return Response.json({review:outcome.review},{headers:RESPONSE_HEADERS});
  }catch(e){const error=e instanceof SafeError?e:new SafeError(503,'unavailable','Reviews are unavailable at the moment. Your transcript is still here; try again later.');await analytics?.finish(analyticsFailure(error.code,request.signal.aborted));return Response.json({error:{code:error.code,message:error.message}},{status:error.status,headers:RESPONSE_HEADERS});}
  finally{if(limiter&&id)try{await limiter.release(id);}catch{/* lease expires even if shared service is unavailable; no content logging */}}
}

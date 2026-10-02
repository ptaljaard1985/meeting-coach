import { exampleRequestSchema, generateExample } from '../examples/generate';
import { createProvider, type Provider } from '../review/judge';
import { readBoundedJson } from './body';
import { getConfig, type Config } from './config';
import { RESPONSE_HEADERS } from './handler';
import { getLimiter, networkKey, type Limiter } from './limits';
import { verifyChallenge } from './challenge';
import { SafeError } from './errors';
import { AnalyticsRun,analyticsFailure,getAnalyticsStore } from './analytics';
import type { AnalyticsStore } from '../analytics';
import { EXAMPLE_MODEL,EXAMPLE_PROMPT_VERSION } from '../examples/prompt';
interface Dependencies {config?:Config;limiter?:Limiter;provider?:Provider;challenge?:typeof verifyChallenge;analytics?:AnalyticsStore}
export async function handleExample(request:Request,deps:Dependencies={}){
  const timing={at:new Date().toISOString(),tick:performance.now()};
  let limiter:Limiter|undefined,id:string|undefined;
  let analytics:AnalyticsRun|undefined;
  try{
    const config=deps.config??getConfig();const expected=config.origin??new URL(request.url).origin;
    if(request.headers.get('origin')!==expected||request.headers.get('sec-fetch-site')==='cross-site')throw new SafeError(403,'origin','Open Meeting Coach in its own browser tab and try again.');
    const parsed=exampleRequestSchema.safeParse(await readBoundedJson(request,4096));
    if(!parsed.success)throw new SafeError(400,'input','The example request could not be read. No existing transcript is needed to generate an example.');
    if(config.demo)throw new SafeError(503,'demo_only','AI example generation is available in live mode once the operator configures the API. You can still load the short synthetic preview.');
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(config.timeout)]);
    limiter=deps.limiter??getLimiter(config);const network=networkKey(request,config);await limiter.begin(parsed.data.requestId,network);id=parsed.data.requestId;
    await (deps.challenge??verifyChallenge)(parsed.data.challengeToken,{...config,origin:expected},signal);
    analytics=new AnalyticsRun(deps.analytics??getAnalyticsStore(config),{kind:'example',model:EXAMPLE_MODEL,promptVersion:EXAMPLE_PROMPT_VERSION,rubricVersion:null},timing);
    const example=await generateExample(parsed.data,config.timeout,analytics.wrap(deps.provider??createProvider(process.env.OPENAI_API_KEY!,config.timeout)),()=>limiter!.reserve(id!,network),signal);
    await analytics.finish('success');
    return Response.json({example},{headers:RESPONSE_HEADERS});
  }catch(e){const error=e instanceof SafeError?e:new SafeError(503,'unavailable','Example generation is unavailable. Your current transcript is unchanged; try again later.');await analytics?.finish(analyticsFailure(error.code,request.signal.aborted));return Response.json({error:{code:error.code,message:error.message}},{status:error.status,headers:RESPONSE_HEADERS});}
  finally{if(limiter&&id)try{await limiter.release(id);}catch{/* lease expires without content storage */}}
}

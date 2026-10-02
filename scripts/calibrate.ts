// Opt-in local calibration. No hosted evaluation dataset or content output.
import { readFile } from 'node:fs/promises';
import { loadEnvConfig } from '@next/env';
import { prepareInput } from '../lib/review/input';
import { DEMO_TRANSCRIPT } from '../lib/demo-transcript';
import { NOTICE_VERSION } from '../lib/constants';
import { getConfig } from '../lib/server/config';
import { MemoryLimiter } from '../lib/server/limits';
import { createProvider,judge } from '../lib/review/judge';
const args=process.argv.slice(2);
if(!args.includes('--allow-paid')){console.error('No calls made. Explicit opt-in required: npm run calibrate -- --allow-paid [--labels path.json]. Maximum four paid calls for the same synthetic example.');process.exit(1);}
loadEnvConfig(process.cwd());
if(!process.env.OPENAI_API_KEY){console.error('No calls made. Configure a dedicated project key first.');process.exit(1);}
const labelsPath=args[args.indexOf('--labels')+1];
const labels=args.includes('--labels')?JSON.parse(await readFile(labelsPath,'utf8')) as {scoreValues?:Record<string,number>;notAssessableCriteria?:string[]}:{};
const prepared=prepareInput({transcript:DEMO_TRANSCRIPT,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client A',role:'client'},{speaker:'Client B',role:'client'}],context:'couple',acknowledgement:true,noticeVersion:NOTICE_VERSION,requestId:crypto.randomUUID()});
for(const model of ['gpt-6-astra','gpt-6.1-sol']){
  const config=getConfig({...process.env,NODE_ENV:'development',REVIEW_MODE:'live',REVIEW_MODEL:model});const limit=new MemoryLimiter({...config,daily:4,hourly:4,concurrency:1});const id=crypto.randomUUID();await limit.begin(id,'local-calibration');const start=performance.now();
  try{const result=await judge(prepared,config,createProvider(process.env.OPENAI_API_KEY,config.timeout),()=>limit.reserve(id,'local-calibration'),new AbortController().signal);const r=result.review;
    const errors=r.scores.flatMap(s=>s.value===null||labels.scoreValues?.[s.score_id]===undefined?[]:[Math.abs(s.value-labels.scoreValues[s.score_id])]);
    const na=r.scores.flatMap(s=>s.criteria.filter(c=>c.verdict==='not_assessable').map(c=>c.criterion_id));
    const disagreement=labels.notAssessableCriteria?[...new Set([...na,...labels.notAssessableCriteria])].filter(id=>na.includes(id)!==labels.notAssessableCriteria!.includes(id)):undefined;
    console.log(JSON.stringify({model,latencyMs:Math.round(performance.now()-start),attempts:result.attempts,usage:result.usage,overall:r.overall,evidenceFidelity:'all returned quotes passed exact segment validation',notAssessableCriteria:na,notAssessableDisagreement:disagreement,scoreMeanAbsoluteError:errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null,uniqueTakeawayTitles:new Set(r.coaching.map(t=>t.title.toLowerCase())).size}));
    // Console output is explicitly selected synthetic calibration material only.
    console.log('Human review required: rate usefulness and distinctness of these five synthetic takeaways from 1–5.');console.log(JSON.stringify(r.coaching,null,2));
  }catch{console.error(`${model}: review failed safely; no fallback. Reserved calls still count.`);process.exitCode=1;}
  finally{await limit.release(id);}
}

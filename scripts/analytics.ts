// Operator-only CLI. No public analytics endpoint or browser credential.
import { loadEnvConfig } from '@next/env';
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { RedisAnalyticsStore } from '../lib/server/analytics';
import { analyticsCsv,analyticsSummary } from '../lib/analytics';

loadEnvConfig(process.cwd());
const args=process.argv.slice(2);
if(!process.env.UPSTASH_REDIS_REST_URL||!process.env.UPSTASH_REDIS_REST_TOKEN){console.error('No operation performed. Configure the project’s analytics Redis credentials first.');process.exit(1);}
const store=new RedisAnalyticsStore({redisUrl:process.env.UPSTASH_REDIS_REST_URL,redisToken:process.env.UPSTASH_REDIS_REST_TOKEN});
try{
  if(args[0]==='delete'){
    if(args.length!==2||args[1]!=='--confirm-delete'){console.error('No records deleted. Use npm run analytics:delete -- --confirm-delete to delete only the numerical analytics log.');process.exitCode=1;}
    else{await store.deleteAll();console.log('Numerical analytics deleted. Model-call limits and duplicate protections were retained.');}
  }else if(args[0]==='export'){
    if(args.length!==1&&(args.length!==3||args[1]!=='--out'||!args[2]))throw new Error('Invalid arguments.');
    const out=resolve(args[2]??`output/analytics/meeting-coach-usage-${new Date().toISOString().slice(0,10)}.csv`);
    const records=await store.list();await mkdir(dirname(out),{recursive:true});await writeFile(out,analyticsCsv(records),{mode:0o600});
    console.log(`Exported ${records.length} numerical request records to ${out}`);console.log(JSON.stringify(analyticsSummary(records),null,2));
  }else{console.error('Use analytics:export or analytics:delete. No operation performed.');process.exitCode=1;}
}catch{console.error('Analytics operation failed. Check arguments, project credentials and Redis availability. No meeting content was printed.');process.exitCode=1;}

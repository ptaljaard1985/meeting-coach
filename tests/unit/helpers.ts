import { NOTICE_VERSION } from '../../lib/constants';
import { DEMO_TRANSCRIPT } from '../../lib/demo-transcript';
import { prepareInput } from '../../lib/review/input';
import { getConfig } from '../../lib/server/config';
import type { Provider } from '../../lib/review/judge';
export const submission=()=>({transcript:DEMO_TRANSCRIPT,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client A',role:'client'},{speaker:'Client B',role:'client'}],context:'couple',acknowledgement:true,noticeVersion:NOTICE_VERSION,requestId:crypto.randomUUID()});
export const prepared=()=>prepareInput(submission());
export const config=(overrides:Record<string,string>={})=>getConfig({NODE_ENV:'development',REVIEW_MODE:'live',OPENAI_API_KEY:'synthetic-test-key',...overrides});
export const provider=(raw:unknown):Provider=>async()=>({status:'completed',output:[],output_text:JSON.stringify(raw),usage:undefined});

import type { MeetingMetrics, Verdict } from './types';
export const METRIC_CAVEAT='Question turns count adviser turns ending in a question mark; this is not a full linguistic question count. Speaking spans and shares are estimates, not measured audio.';
export const verdictLabel=(verdict:Verdict)=>({met:'Met',partially_met:'Partially met',not_met:'Not met',not_assessable:'Not assessable'})[verdict];
export function metricRows(m:MeetingMetrics):[string,string][]{return [
  ['Adviser talk share',m.talk_share_adviser===null?'n/a':`${Math.round(m.talk_share_adviser*100)}%`],
  ['Question turns',String(m.question_count_adviser)],
  ['Longest adviser span',m.longest_adviser_monologue_s===null?'n/a':`${m.longest_adviser_monologue_s}s`],
  ['Longest client span',m.longest_client_monologue_s===null?'n/a':`${m.longest_client_monologue_s}s`],
  ['Duration',m.duration_min===null?'n/a':`${m.duration_min} min${m.duration_is_estimate?' (est.)':''}`],
  ['Client speaking balance',m.client_balance_ratio===null?'n/a':`${m.client_balance_ratio}:1`]
];}

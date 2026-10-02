import { z } from 'zod';

const score=z.number().min(1).max(5).nullable();
const tokens=z.number().int().min(0).max(10_000_000);
export const analysisRecordSchema=z.strictObject({
  schemaVersion:z.literal(1),id:z.uuid(),
  kind:z.enum(['review','example']),model:z.enum(['gpt-6-astra','gpt-6.1-sol']),
  promptVersion:z.string().regex(/^[a-z0-9][a-z0-9.:_-]{0,79}$/),
  rubricVersion:z.string().regex(/^[a-z0-9][a-z0-9.:_-]{0,79}$/).nullable(),
  startedAt:z.iso.datetime(),finishedAt:z.iso.datetime().nullable(),durationMs:z.number().int().min(0).max(3_600_000),
  outcome:z.enum(['running','success','timeout','cancelled','provider_error','validation_error','incomplete','refusal','other_error']),
  modelCalls:z.number().int().min(1).max(2),
  usageComplete:z.boolean(),inputTokens:tokens,outputTokens:tokens,cachedInputTokens:tokens,cacheWriteTokens:tokens,reasoningTokens:tokens,
  overallScore:score,categoryScores:z.array(score).length(7).nullable(),
});
export type AnalysisRecord=z.infer<typeof analysisRecordSchema>;
export type AnalysisOutcome=AnalysisRecord['outcome'];
export interface AnalyticsStore {write(record:AnalysisRecord):Promise<void>}

export function getAnalyticsSettings(env:NodeJS.ProcessEnv=process.env){
  const enabled=env.ANALYTICS_ENABLED??'true';
  if(!['true','false'].includes(enabled))throw new Error('ANALYTICS_ENABLED must be true or false.');
  return {enabled:enabled==='true'};
}

const columns=['id','startedAt','finishedAt','kind','model','promptVersion','rubricVersion','outcome','durationMs','modelCalls','usageComplete','inputTokens','outputTokens','cachedInputTokens','cacheWriteTokens','reasoningTokens','overallScore','s1','s2','s3','s4','s5','s6','s7'] as const;
const csvCell=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`;
export function analyticsCsv(records:AnalysisRecord[]){
  const rows=records.map(record=>{
    const r=analysisRecordSchema.parse(record);
    return [r.id,r.startedAt,r.finishedAt,r.kind,r.model,r.promptVersion,r.rubricVersion,r.outcome,r.durationMs,r.modelCalls,r.usageComplete,r.inputTokens,r.outputTokens,r.cachedInputTokens,r.cacheWriteTokens,r.reasoningTokens,r.overallScore,...(r.categoryScores??Array(7).fill(null))].map(csvCell).join(',');
  });
  return [columns.join(','),...rows].join('\r\n')+'\r\n';
}
export function analyticsSummary(records:AnalysisRecord[]){
  const rows=records.map(r=>analysisRecordSchema.parse(r));
  const finished=rows.filter(r=>r.outcome!=='running');
  const durations=finished.map(r=>r.durationMs).sort((a,b)=>a-b);
  const values=rows.filter(r=>r.kind==='review'&&r.outcome==='success'&&r.overallScore!==null).map(r=>r.overallScore!);
  const mean=(values:number[])=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null;
  const percentile=(q:number)=>durations.length?durations[Math.ceil(durations.length*q)-1]:null;
  return {requests:rows.length,reviews:rows.filter(r=>r.kind==='review').length,examples:rows.filter(r=>r.kind==='example').length,
    succeeded:rows.filter(r=>r.outcome==='success').length,failed:finished.filter(r=>r.outcome!=='success').length,runningOrInterrupted:rows.length-finished.length,
    modelCalls:rows.reduce((n,r)=>n+r.modelCalls,0),recordsWithIncompleteUsage:rows.filter(r=>!r.usageComplete).length,
    meanDurationMs:mean(durations),p50DurationMs:percentile(.5),p95DurationMs:percentile(.95),meanOverallScore:mean(values),
    inputTokens:rows.reduce((n,r)=>n+r.inputTokens,0),outputTokens:rows.reduce((n,r)=>n+r.outputTokens,0)};
}

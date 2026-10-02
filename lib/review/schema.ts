import { z } from 'zod';
import rubric from '../rubric.json';
import type { MeetingContext, Segment, Review, MeetingMetrics } from '../types';
import { PROMPT_VERSION } from '../constants';
const text = z.string().trim().min(1).max(4000);
const evidence = z.strictObject({ segment_id: z.string().min(1), quote: z.string().min(1).max(4000) });
const criterion = z.strictObject({ criterion_id: z.string(), verdict: z.enum(['met','partially_met','not_met','not_assessable']), evidence: z.array(evidence).max(4), rationale: text });
const score = z.strictObject({ score_id: z.string(), assessable: z.boolean(), value: z.number().min(1).max(5).nullable(), summary: text, criteria: z.array(criterion).min(1).max(4) });
export const rawReviewSchema = z.strictObject({ scores: z.array(score).length(7), coaching: z.array(z.strictObject({ title: z.string().trim().min(1).max(100), learning: text, example: text })).length(5), confidence: z.enum(['high','medium','low']) });
export const REVIEW_JSON_SCHEMA = z.toJSONSchema(rawReviewSchema, { target: 'draft-7' });
export class InvalidReview extends Error {
  constructor(public code: string) { super(code); }
}
export function validateReview(raw: unknown, segments: Segment[], context: MeetingContext) {
  const parsed=rawReviewSchema.safeParse(raw);
  if(!parsed.success)throw new InvalidReview('output_shape');
  const data=parsed.data;const seen=new Set<string>();const source=new Map(segments.map(s=>[s.id,s]));
  for(const s of data.scores){const expected=rubric.scores.find(x=>x.id===s.score_id);
    if(!expected||seen.has(s.score_id))throw new InvalidReview('score_ids');seen.add(s.score_id);
    if(s.criteria.length!==expected.criteria.length)throw new InvalidReview('criterion_count');
    const criteriaSeen=new Set<string>();
    for(const c of s.criteria){
      if(!expected.criteria.some(x=>x.id===c.criterion_id)||criteriaSeen.has(c.criterion_id))throw new InvalidReview('criterion_ids_or_parent');criteriaSeen.add(c.criterion_id);
      if(c.verdict!=='not_assessable'&&!c.evidence.length)throw new InvalidReview('evidence_required');
      if(!s.assessable&&c.verdict!=='not_assessable')throw new InvalidReview('assessability');
      for(const e of c.evidence){const segment=source.get(e.segment_id);if(!e.quote.trim()||!segment||!segment.text.includes(e.quote))throw new InvalidReview('quote_segment_mismatch');}
    }
    if(s.assessable!==(s.value!==null)||s.assessable!==s.criteria.some(c=>c.verdict!=='not_assessable'))throw new InvalidReview('assessability');
    if(expected.position===7&&context!=='couple'&&s.assessable)throw new InvalidReview('couple_scope');
  }
  const scores=rubric.scores.map(def=>{
    const s=data.scores.find(x=>x.score_id===def.id)!;
    return {...s,criteria:def.criteria.map(c=>{const result=s.criteria.find(x=>x.criterion_id===c.id)!;return {...result,evidence:result.evidence.map(e=>{const sourceSegment=source.get(e.segment_id)!;return {...e,speaker:sourceSegment.speaker.display_name,timestamp:sourceSegment.timestamp};})};})};
  });
  const values=scores.flatMap(s=>s.value===null?[]:[s.value]);
  return {...data,scores,overall:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null};
}
export function makeReview(raw: unknown, segments: Segment[], context: MeetingContext, metrics: MeetingMetrics, model: string, demo=false): Review {
  return {...validateReview(raw,segments,context),metrics,model,promptVersion:PROMPT_VERSION,rubricVersion:rubric.rubric_version,generatedAt:new Date().toISOString(),reportId:crypto.randomUUID(),demo};
}

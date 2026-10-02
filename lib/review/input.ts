import { z } from 'zod';
import { NOTICE_VERSION, MAX_TRANSCRIPT_BYTES } from '../constants';
import { parseTranscript } from '../transcripts';
import { checkRoles } from '../roles';
import { computeMeetingMetrics } from '../metrics';
export const submissionSchema=z.strictObject({
  transcript:z.string().min(1).max(MAX_TRANSCRIPT_BYTES),
  roles:z.array(z.strictObject({speaker:z.string().min(1).max(60),role:z.enum(['adviser','client','observer'])})).min(2).max(12),
  context:z.enum(['single','couple','other']), knownDurationSeconds:z.number().positive().max(28_800).optional(),
  acknowledgement:z.literal(true),noticeVersion:z.literal(NOTICE_VERSION),
  requestId:z.uuid(),challengeToken:z.string().max(2048).optional()
});
export function prepareInput(raw:unknown){
  const input=submissionSchema.parse(raw);const parsed=parseTranscript(input.transcript);checkRoles(parsed,input.roles,input.context);
  if(input.knownDurationSeconds && parsed.segments.some(s=>{ const p=s.timestamp.replace(',','.').split(':').map(Number);return p.length===3&&p[0]*3600+p[1]*60+p[2]>=input.knownDurationSeconds!;}))throw new Error('Known duration must extend beyond the last transcript timestamp.');
  const metrics=computeMeetingMetrics({segments:parsed.segments,roles:input.roles,context:input.context,knownDurationSeconds:input.knownDurationSeconds});
  if(!metrics.diarised)throw new Error('Speaker attribution appears incomplete. Re-export with distinct adviser and client labels before reviewing.');
  return {input,parsed,metrics};
}
export type PreparedInput=ReturnType<typeof prepareInput>;

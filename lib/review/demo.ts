import rubric from '../rubric.json';
import { DEMO_TRANSCRIPT } from '../demo-transcript';
import { makeReview } from './schema';
import type { PreparedInput } from './input';
import { SafeError } from '../server/errors';
import type { MeetingContext } from '../types';
export function demoRaw(context:MeetingContext='couple'){
  const evidenceSegments:[[number,number],...[number,number][]]=[[1,3],[3,7],[3,7],[7,7],[10,13],[3,4],[5,6]];
  const summaries=['The opening engaged with the person and let both clients shape the agenda.','Questions and reflections followed the clients’ own priorities.','Concern about time was named; this excerpt offers no market-turbulence rehearsal.','The discussion stayed in everyday language and checked the order of the meeting.','The adviser named owners and a deadline, then read back the next steps.','The discussion connected to time at home and a change in working hours.','Both clients contributed and confirmed the next steps.'];
  return {scores:rubric.scores.map((s,i)=>{const assessable=i!==6||context==='couple'||context==='couple_shared';return {score_id:s.id,assessable,value:assessable?[4,4,3,4,4,4,3][i]:null,summary:assessable?summaries[i]:'This category applies only to an explicitly confirmed couple meeting.',criteria:s.criteria.map((c,j)=>{
    const relevant=assessable && !(i===2&&j>=1) && !(i===3&&j===2) && !(i===6&&(context==='couple_shared'?j===0||j===3:j===1));
    const segment=evidenceSegments[i][j%2];return {criterion_id:c.id,verdict:relevant?'met' as const:'not_assessable' as const,rationale:relevant?'Illustrative coaching only: this excerpt contains a relevant interaction. A live review would evaluate it against the full criterion.':'The excerpt does not establish an opportunity to assess this criterion. Absence is not a failure.',evidence:relevant?[{segment_id:`segment-${segment}`,quote:DEMO_QUOTES[segment]}]:[]};})};}),
    coaching:[
      {title:'Lead with the person',learning:'Make space for life before looking at figures. Reflect what the client says so the opening shapes the conversation.',example:'The adviser opened with a check-in and reflected Client A’s wish for more control over time (segments 1–3).'},
      {title:'Let each voice shape the agenda',learning:'Invite each client to say what would make the meeting useful. Use those answers to agree the order together.',example:'Client B was asked what would make the conversation useful, and the adviser placed that concern first (segments 5–7).'},
      {title:'Name the feeling first',learning:'Reflect the worry before moving into analysis. Check the reflection so the client can correct your understanding.',example:'The adviser reflected that time mattered as much as money and asked whether that was understood correctly (segment 3).'},
      {title:'Make next steps concrete',learning:'Give each action an owner and a time. Ask about obstacles while there is still room to work through them.',example:'Both clients were asked to send work-hour estimates by Friday, followed by a question about what could get in the way (segment 10).'},
      {title:'Close with a shared readback',learning:'Restate the commitments before ending. Allow each client to confirm or correct the account in their own voice.',example:'The adviser read back the plan and both clients confirmed the agreed steps (segments 13–15).'}
    ],confidence:'low' as const};
}
const DEMO_QUOTES:Record<number,string>={1:'Before we look at the numbers, how have things been since we last spoke?',3:'It sounds as though having more control over your time matters as much as the money. Have I understood that correctly?',4:'Yes. I want to be around after school instead of working every evening.',5:'And what would make this conversation useful for you, Client B?',6:'I want to know what happens if one of us stops work earlier than planned.',7:'Let us start there, then look at the reduced-hours option. We can test the plan against lower income without deciding anything today. How does that order sound?',10:'For next time, I will prepare those two scenarios. Could you each send your expected work hours by Friday? What might get in the way of doing that?',13:'Then I will prepare the scenarios once both estimates arrive. You are each sending your work-hour estimate by Friday. Have I captured our next steps correctly?'};
export function demoReview(prepared:PreparedInput){
  if(prepared.input.transcript.replace(/\r\n/g,'\n').trim()!==DEMO_TRANSCRIPT.trim()||prepared.input.roles.find(r=>r.role==='adviser')?.speaker!=='Adviser')throw new SafeError(503,'demo_only','This local preview reviews the supplied synthetic example only. Load the example, or configure live reviews on the server.');
  return makeReview(demoRaw(prepared.input.context),prepared.parsed.segments,prepared.input.context,prepared.metrics,'Synthetic demonstration',true);
}

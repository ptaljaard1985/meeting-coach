import type { ParsedTranscript } from './transcripts';
import type { MeetingContext, SpeakerRole } from './types';
export function checkRoles(parsed: ParsedTranscript, roles: SpeakerRole[], context: MeetingContext) {
  const labels=parsed.speakers.map(s=>s.name);
  if(roles.length!==labels.length || new Set(roles.map(r=>r.speaker)).size!==labels.length || roles.some(r=>!labels.includes(r.speaker))) throw new Error('Confirm a role for every detected speaker.');
  const advisers=roles.filter(r=>r.role==='adviser');const clients=roles.filter(r=>r.role==='client');
  if(advisers.length!==1)throw new Error('Explicitly select one adviser.');
  if(!clients.length)throw new Error('Confirm at least one client.');
  if(context==='single'&&clients.length!==1)throw new Error('A single-client meeting must have one client. Choose another context or correct the roles.');
  if(context==='couple'&&clients.length!==2)throw new Error('A couple meeting must have exactly two clients. Observers are separate.');
}

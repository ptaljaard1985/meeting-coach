import { describe,it,expect } from 'vitest';
import { parseTranscript,parseTimestamp } from '../../lib/transcripts';
import { computeMeetingMetrics } from '../../lib/metrics';
import { checkRoles } from '../../lib/roles';
import golden from '../fixtures/golden.json';
import type { Segment,SpeakerRole } from '../../lib/types';
const roles:SpeakerRole[]=[{speaker:'Adviser',role:'adviser'},{speaker:'Client A',role:'client'},{speaker:'Client B',role:'client'}];
describe('local parser extraction',()=>{
  it.each([
    ['inline','[00:00:01] Adviser: How are you?\n[00:00:05] Client: Yes, thank you.','inline_speaker'],
    ['blocks','Adviser\n00:00:01\nHow are you?\n\n00:00:03\nAnything else?\n\nClient\n00:00:05\nYes, thank you.','speaker_blocks'],
    ['VTT','WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Adviser>How are you?</v>\n\n00:00:05.000 --> 00:00:08.000\n<v Client>Yes, thank you.</v>','vtt'],
    ['SRT','1\n00:00:01,000 --> 00:00:04,000\nAdviser: How are you?\n\n2\n00:00:05,000 --> 00:00:08,000\nClient: Yes, thank you.','srt'],
  ])('supports %s with real timestamps',(_,raw,format)=>{const p=parseTranscript(raw);expect(p.format).toBe(format);expect(p.hasTimestamps).toBe(true);expect(p.segments.at(-1)?.text).toBe('Yes, thank you.');expect(p.segments[0].id).toBe('segment-1');expect(p.segments.at(-1)?.timestamp).toBe('00:00:05.000'.replace('.000',format==='vtt'||format==='srt'?'.000':''));});
  it('does not fabricate timestamps',()=>{const p=parseTranscript('Speaker 1: Hello there.\nSpeaker 2: Hello there.');expect(p.hasTimestamps).toBe(false);expect(p.segments.every(s=>s.timestamp==='')).toBe(true);});
  it.each(['','Plain text without speakers.','Adviser: Only one voice.','WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nUnattributed speech.','Adviser: Hello.\nClient: Hello.\n'+'Unsupported prose. '.repeat(100)])('rejects incomplete/unsupported attribution',raw=>expect(()=>parseTranscript(raw)).toThrow());
  it('rejects oversize and excessive speakers',()=>{expect(()=>parseTranscript('Adviser: '+'x'.repeat(64001))).toThrow(/large/);expect(()=>parseTranscript(Array.from({length:13},(_,i)=>`Speaker ${i}: hello.`).join('\n'))).toThrow(/Too many/);});
  it('rejects invalid clocks for metrics',()=>{expect(parseTimestamp('00:70:00')).toBeNull();expect(parseTimestamp('01:02:03.500')).toBe(3723.5);});
});
describe('ported golden arithmetic and role semantics',()=>{
  const metrics=()=>computeMeetingMetrics({segments:golden as Segment[],roles,context:'couple'});
  it('preserves source golden calculations',()=>{const m=metrics();expect(m.talk_share_adviser).toBe(.5894);expect(m.question_count_adviser).toBe(3);expect(m.longest_adviser_monologue_s).toBe(220);expect(m.longest_client_monologue_s).toBe(120);expect(m.client_balance_ratio).toBe(5);expect(m.duration_min).toBe(8.8);expect(m.duration_is_estimate).toBe(true);expect(metrics()).toEqual(m);});
  it('known duration changes total without creating evidence positions',()=>{const segments=parseTranscript('Adviser: one two three four\nClient: one two three four five six seven eight nine ten').segments;const m=computeMeetingMetrics({segments,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client',role:'client'}],context:'single',knownDurationSeconds:120});expect(m.talk_share_adviser).toBe(.2857);expect(m.duration_min).toBe(2);expect(m.duration_is_estimate).toBe(false);expect(segments[1].timestamp).toBe('');expect(m.longest_adviser_monologue_s).toBe(1.7);});
  it('does not turn observer time into client time or extend a monologue',()=>{const segments=parseTranscript('[00:00:00] Adviser: Hello.\n[00:00:10] Observer: Admin.\n[00:02:00] Adviser: Hello again.\n[00:02:10] Client: Yes.').segments;const m=computeMeetingMetrics({segments,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Observer',role:'observer'},{speaker:'Client',role:'client'}],context:'single',knownDurationSeconds:140});expect(m.talk_share_adviser).toBe(.6667);expect(m.longest_adviser_monologue_s).toBe(10);expect(m.client_shares).toEqual([{speaker:'Client',share:.3333}]);expect(m.client_balance_ratio).toBeNull();expect(m.duration_min).toBe(2.3);});
  it('keeps partial-diarisation quality gate',()=>{const segments=parseTranscript('Adviser: Shall we begin?\n'+Array.from({length:20},()=> 'Speaker 2: A long stretch of speech.').join('\n')).segments;const m=computeMeetingMetrics({segments,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Speaker 2',role:'client'}],context:'single'});expect(m.diarised).toBe(false);expect(m.talk_share_adviser).toBeNull();expect(m.client_shares).toEqual([]);});
  it('allows confirmed generic labels with reliable attribution',()=>{const p=parseTranscript('Speaker 1: Hello?\nSpeaker 2: Yes.');const r:SpeakerRole[]=[{speaker:'Speaker 1',role:'adviser'},{speaker:'Speaker 2',role:'client'}];checkRoles(p,r,'single');expect(computeMeetingMetrics({segments:p.segments,roles:r,context:'single'}).diarised).toBe(true);});
  it('never assumes any two non-advisers are a couple',()=>{expect(computeMeetingMetrics({segments:golden as Segment[],roles,context:'other'}).client_balance_ratio).toBeNull();});
  it('uses estimates for repeated timestamps',()=>{const p=parseTranscript('[00:00:00] Adviser: One two.\n[00:00:00] Client: Three four.');const m=computeMeetingMetrics({segments:p.segments,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client',role:'client'}],context:'single'});expect(m.talk_share_adviser).toBe(.5);expect(m.longest_adviser_monologue_s).toBe(.9);});
});

// Adapted from supplied CRM parse.ts. No fabricated timestamp distribution.
import type { Segment } from './types';
import { MAX_TRANSCRIPT_BYTES } from './constants';
export class TranscriptParseError extends Error {}
export const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const bare = /^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?$/;
const inline = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s+)?([^:\n]{1,60}):\s+(.*)$/;
const cue = /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})(?:\s+.*)?$/;
const cueAny = /^(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s+.*)?$/;
function stamp(t: string) { const p=t.replace(',', '.').split(':'); if(p.length===2)p.unshift('00'); return p.map((v,i)=>i<2?v.padStart(2,'0'):v.padStart(2,'0')).join(':'); }
export function parseTimestamp(t: string): number | null {
  if (!bare.test(t)) return null;
  const p=t.replace(',', '.').split(':').map(Number); if(p.length===2)p.unshift(0);
  if(p[1]>=60 || p[2]>=60)return null; return p[0]*3600+p[1]*60+p[2];
}
interface Candidate { segments: Segment[]; covered: Set<number> }
export function parseTranscript(raw: string) {
  if(!raw.trim()) throw new TranscriptParseError('Paste a speaker-labelled transcript to begin.');
  if(new TextEncoder().encode(raw).length>MAX_TRANSCRIPT_BYTES) throw new TranscriptParseError('This transcript is too large. Use an excerpt of up to 64 KB.');
  const lines=raw.replace(/\r\n?/g,'\n').split('\n');
  const make=():Candidate=>({segments:[],covered:new Set()});
  const push=(c:Candidate,speaker:string,text:string,timestamp:string,indices:number[])=>{
    if(!text.trim())return;
    c.segments.push({id:`segment-${c.segments.length+1}`,speaker:{display_name:speaker.trim()},text:text.trim(),timestamp}); indices.forEach(i=>c.covered.add(i));
  };
  const a=make(); lines.forEach((line,i)=>{const m=inline.exec(line.trim());if(m)push(a,m[2],m[3],m[1]?stamp(m[1]):'',[i]);});
  const b=make(); let previous=''; let group:number[]=[];
  const block=()=>{
    if(!group.length)return;const first=lines[group[0]].trim();let speaker=previous,timestamp='',start=1;
    if(bare.test(first)){if(!previous){group=[];return;}timestamp=stamp(first);}
    else {if(group.length<2 || first.length>60 || first.split(/\s+/).length>6 || /[.?!,;:]$/.test(first) || /^[#>\-]/.test(first)){group=[];return;} speaker=first;
      if(bare.test(lines[group[1]].trim())){timestamp=stamp(lines[group[1]].trim());start=2;}}
    push(b,speaker,group.slice(start).map(i=>lines[i].trim()).join(' '),timestamp,group);previous=speaker;group=[];
  };
  lines.forEach((line,i)=>{if(line.trim())group.push(i);else block();});block();
  const hasCues=lines.some(l=>cueAny.test(l.trim()) || cue.test(l.trim()));
  let selected= a.segments.length>b.segments.length?a:b;
  let format: 'inline_speaker'|'speaker_blocks'|'vtt'|'srt'=selected===a?'inline_speaker':'speaker_blocks';
  if(hasCues){const c=make(); previous='';group=[]; let timestamp='';
    const flush=()=>{if(!group.length)return;const text=group.slice(1).map(i=>lines[i].trim()).join(' ');
      const voice=/^<v\s+([^>]+)>\s*(.*?)(?:<\/v>)?$/.exec(text); const named=/^([^:]{1,60}):\s+(.*)$/.exec(text);
      const speaker=voice?.[1]??named?.[1]??previous;
      if(speaker)push(c,speaker,voice?.[2]??named?.[2]??text,timestamp,group);
      previous=speaker;group=[];};
    lines.forEach((line,i)=>{const t=line.trim();const m=cueAny.exec(t);
      if(m){flush();timestamp=stamp(m[1]);group=[i];}
      else if(!t)flush();else if(group.length)group.push(i);
      else if(/^WEBVTT(?:\s.*)?$/i.test(t)||/^\d+$/.test(t))c.covered.add(i);
    });flush();selected=c;format=raw.trimStart().startsWith('WEBVTT')?'vtt':'srt';
  }
  if(!selected.segments.length)throw new TranscriptParseError('No attributed speech found. Use “Name: text”, speaker blocks, or VTT/SRT with speaker labels. Plain text and merged speakers cannot support this review.');
  const missed=lines.filter((l,i)=>l.trim()&&!selected.covered.has(i));
  if(missed.length)throw new TranscriptParseError('Some transcript text could not be attributed. Put a speaker label on each passage, remove export headings, and try again. No partial review was created.');
  if(selected.segments.length>2000)throw new TranscriptParseError('Use an excerpt with at most 2,000 speech segments.');
  const tally=new Map<string,{name:string;words:number;utterances:number}>();
  for(const s of selected.segments){const name=s.speaker.display_name; const v=tally.get(name)??{name,words:0,utterances:0};v.words+=countWords(s.text);v.utterances++;tally.set(name,v);}
  if(tally.size<2 || [...tally.keys()].some(n=>/^(unknown|unidentified|undiarised)$/i.test(n)))throw new TranscriptParseError('At least two separately attributed speakers are needed. Re-export with speaker attribution before reviewing.');
  if(tally.size>12)throw new TranscriptParseError('Too many speaker labels were found. Check the export or use a smaller excerpt.');
  return {segments:selected.segments, format, speakers:[...tally.values()],totalWords:selected.segments.reduce((n,s)=>n+countWords(s.text),0),hasTimestamps:selected.segments.some(s=>!!s.timestamp)};
}
export type ParsedTranscript = ReturnType<typeof parseTranscript>;

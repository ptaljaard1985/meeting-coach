// Adapted from supplied CRM parse.ts. No fabricated timestamp distribution.
import type { Segment } from './types';
import { MAX_TRANSCRIPT_BYTES } from './constants';
export class TranscriptParseError extends Error {}
export const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const bare = /^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?$/;
const inline = /^(?:\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s+)?([^:\n]{1,60}):\s+(.*)$/;
// Header line "1:12:44 - Name (Organisation)", with the speech on the following lines.
const stamped = /^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s+[-–—]\s+(.+)$/;
// Header line "Name  0:03", "Name - 0:03" or "Name (0:03)", with the speech on the following lines.
const trailing = /^(.*?\S)(?:\s+[-–—|]\s+|\s+|\s*(?=[[(]))[[(]?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)[\])]?$/;
// Divider lines such as "---" or "***" carry no speech and are read as blank lines.
const divider = /^[-–—*_=~#•·]{3,}$/;
// Export headings before the first turn and footers after the last: at most this many short lines are skipped.
const EDGE_LINES = 10, EDGE_LINE_CHARS = 300;
const cue = /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})(?:\s+.*)?$/;
const cueAny = /^(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)(?:\s+.*)?$/;
function stamp(t: string) { const p=t.replace(',', '.').split(':'); if(p.length===2)p.unshift('00'); return p.map((v,i)=>i<2?v.padStart(2,'0'):v.padStart(2,'0')).join(':'); }
const speakerName = (n: string) => n.length<=80 && n.split(/\s+/).length<=10 && !/[.?!,;:]$/.test(n) && !/^[#>\-]/.test(n) && !bare.test(n);
export function parseTimestamp(t: string): number | null {
  if (!bare.test(t)) return null;
  const p=t.replace(',', '.').split(':').map(Number); if(p.length===2)p.unshift(0);
  if(p[1]>=60 || p[2]>=60)return null; return p[0]*3600+p[1]*60+p[2];
}
export function skippedSummary({before,after}:{before:number;after:number}) {
  const count=(n:number)=>`${n} line${n===1?'':'s'}`;
  const parts=[before?`${count(before)} before the first speaker`:'',after?`${count(after)} after the last speaker`:''].filter(Boolean);
  return parts.length?`skipped ${parts.join(' and ')}`:'';
}
interface Candidate { segments: Segment[]; covered: Set<number>; spans: number[][] }
export function parseTranscript(raw: string) {
  if(!raw.trim()) throw new TranscriptParseError('Paste a speaker-labelled transcript to begin.');
  const size=new TextEncoder().encode(raw).length;
  if(size>MAX_TRANSCRIPT_BYTES) throw new TranscriptParseError(`This transcript is ${Math.ceil(size/1000)} KB. The limit is ${MAX_TRANSCRIPT_BYTES/1000} KB (roughly three hours of conversation). Use a shorter excerpt.`);
  const lines=raw.replace(/\r\n?/g,'\n').split('\n').map(l=>divider.test(l.trim())?'':l);
  const make=():Candidate=>({segments:[],covered:new Set(),spans:[]});
  const push=(c:Candidate,speaker:string,text:string,timestamp:string,indices:number[])=>{
    if(!text.trim())return;
    c.segments.push({id:`segment-${c.segments.length+1}`,speaker:{display_name:speaker.trim()},text:text.trim(),timestamp}); c.spans.push(indices); indices.forEach(i=>c.covered.add(i));
  };
  const a=make(); lines.forEach((line,i)=>{const m=inline.exec(line.trim());if(m)push(a,m[2],m[3],m[1]?stamp(m[1]):'',[i]);});
  const b=make(); let previous=''; let group:number[]=[];
  const block=()=>{
    if(!group.length)return;const first=lines[group[0]].trim();let speaker=previous,timestamp='',start=1;
    const timeFirst=stamped.exec(first),timeLast=trailing.exec(first);
    if(bare.test(first)){if(!previous){group=[];return;}timestamp=stamp(first);}
    else if(timeFirst&&group.length>=2&&speakerName(timeFirst[2])){timestamp=stamp(timeFirst[1]);speaker=timeFirst[2];}
    else if(timeLast&&group.length>=2&&speakerName(timeLast[1])){timestamp=stamp(timeLast[2]);speaker=timeLast[1];}
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
  const {segments:all,spans,covered}=selected;
  if(!all.length)throw new TranscriptParseError('No attributed speech found. Use “Name: text”, speaker blocks, or VTT/SRT with speaker labels. Plain text and merged speakers cannot support this review.');
  // Export headings and footers. Around a timestamped conversation, untimestamped "turns" by labels that
  // never speak inside it (a meeting title, a recording link) are headings. Short unattributed lines before
  // the first turn or after the last are skipped and reported. Unattributed text inside the conversation is refused.
  let from=0,to=all.length-1;const timed=all.flatMap((s,i)=>s.timestamp?[i]:[]);
  if(timed.length>=2){const inner=new Set(all.slice(timed[0],timed.at(-1)!+1).map(s=>s.speaker.display_name));const outside=(s:Segment)=>!inner.has(s.speaker.display_name);
    if(all.slice(0,timed[0]).every(outside))from=timed[0];
    if(all.slice(timed.at(-1)!+1).every(outside))to=timed.at(-1)!;}
  const dropped=new Set([...spans.slice(0,from),...spans.slice(to+1)].flat());
  const range=(lo:number,hi:number)=>Array.from({length:Math.max(0,hi-lo)},(_,k)=>lo+k);
  const edge=(i:number)=>!!lines[i].trim()&&(!covered.has(i)||dropped.has(i));
  const fits=(xs:number[])=>xs.length<=EDGE_LINES&&xs.every(i=>lines[i].trim().length<=EDGE_LINE_CHARS);
  let first=Math.min(...spans[from]),last=Math.max(...spans[to]);
  let head=range(0,first).filter(edge),foot=range(last+1,lines.length).filter(edge);
  if(!fits(head)){from=0;first=0;head=[];}
  if(!fits(foot)){to=all.length-1;last=lines.length-1;foot=[];}
  const missed=range(first,last+1).find(i=>lines[i].trim()&&!covered.has(i));
  if(missed!==undefined){const text=lines[missed].trim();throw new TranscriptParseError(`Line ${missed+1} is not attributed to a speaker: “${text.length>80?`${text.slice(0,80)}…`:text}”. Put a speaker label on each passage, or remove headings and notes, then try again. No partial review was created.`);}
  const segments=all.slice(from,to+1).map((s,i)=>({...s,id:`segment-${i+1}`}));
  if(segments.length>2000)throw new TranscriptParseError('Use an excerpt with at most 2,000 speech segments.');
  const tally=new Map<string,{name:string;words:number;utterances:number}>();
  for(const s of segments){const name=s.speaker.display_name; const v=tally.get(name)??{name,words:0,utterances:0};v.words+=countWords(s.text);v.utterances++;tally.set(name,v);}
  if(tally.size<2 || [...tally.keys()].some(n=>/^(unknown|unidentified|undiarised)$/i.test(n)))throw new TranscriptParseError('At least two separately attributed speakers are needed. Re-export with speaker attribution before reviewing.');
  if(tally.size>12)throw new TranscriptParseError('Too many speaker labels were found. Check the export or use a smaller excerpt.');
  return {segments, format, speakers:[...tally.values()],totalWords:segments.reduce((n,s)=>n+countWords(s.text),0),hasTimestamps:segments.some(s=>!!s.timestamp),skipped:{before:head.length,after:foot.length}};
}
export type ParsedTranscript = ReturnType<typeof parseTranscript>;

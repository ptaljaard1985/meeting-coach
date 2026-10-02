import React from 'react';
import { mkdir,writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReportDocument } from '../lib/pdf';
import { demoRaw } from '../lib/review/demo';
import { prepareInput } from '../lib/review/input';
import { DEMO_TRANSCRIPT } from '../lib/demo-transcript';
import { NOTICE_VERSION } from '../lib/constants';
import { makeReview } from '../lib/review/schema';
import rubric from '../lib/rubric.json';
const prepared=prepareInput({transcript:DEMO_TRANSCRIPT,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client A',role:'client'},{speaker:'Client B',role:'client'}],context:'couple',acknowledgement:true,noticeVersion:NOTICE_VERSION,requestId:crypto.randomUUID()});
await mkdir('tmp/pdfs',{recursive:true});
for(const long of [false,true]){
  const raw=demoRaw();const segments=structuredClone(prepared.parsed.segments);
  if(long){const quote=('The café visit was a chance to reflect, without being naïve. '.repeat(55)+'END OF LONG QUOTE').trim();segments[0].text=quote;for(const score of raw.scores)for(const criterion of score.criteria){criterion.rationale='This is a synthetic layout stress test. '.repeat(30)+'END OF RATIONALE';for(const evidence of criterion.evidence)if(evidence.segment_id==='segment-1')evidence.quote=quote;}raw.coaching[4].example+=' END OF FINAL TAKEAWAY';}
  const review=makeReview(raw,segments,'couple',prepared.metrics,'Synthetic demonstration',true);
  const file=`tmp/pdfs/${long?'long':'standard'}-review.pdf`;const buffer=await renderToBuffer(<ReportDocument review={review} title="Synthetic review · Café review"/>);await writeFile(file,buffer);
  const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
  const expected=[...rubric.scores.flatMap(s=>[s.name,...s.criteria.map(c=>c.text)]),...review.coaching.flatMap(t=>[t.title,t.learning,t.example]),'Meeting Coach','Café review'];
  for(const item of expected)if(!text.includes(item.replace(/\s+/g,' ')))throw new Error(`PDF omitted content: ${item.slice(0,60)}`);
  if(long&&!text.includes('END OF LONG QUOTE'))throw new Error('Long quote clipped');
  execFileSync('pdftoppm',['-scale-to','1000','-png',file,`tmp/pdfs/${long?'long':'standard'}-page`]);
  console.log(`${file}: ${buffer.length} bytes; all 7 categories, 24 criteria, 5 takeaways and expected glyphs present.`);
}

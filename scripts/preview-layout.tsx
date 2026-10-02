// Offline visual QA only: actual React markup/CSS, no hydration, server or model calls.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import Coach from '../components/Coach';
import Results from '../components/Results';
import {prepareInput} from '../lib/review/input';
import {demoReview} from '../lib/review/demo';
import {DEMO_TRANSCRIPT} from '../lib/demo-transcript';
import {NOTICE_VERSION} from '../lib/constants';
import {metricRows} from '../lib/report';
import WaitingNotice from '../components/WaitingNotice';

const prepared=prepareInput({transcript:DEMO_TRANSCRIPT,roles:[{speaker:'Adviser',role:'adviser'},{speaker:'Client A',role:'client'},{speaker:'Client B',role:'client'}],context:'couple',acknowledgement:true,noticeVersion:NOTICE_VERSION,requestId:crypto.randomUUID()});
const review=demoReview(prepared);
let css=await readFile('tokens.css','utf8')+(await readFile('app/globals.css','utf8')).replace(/^@import.*$/gm,'');
for(const [family,weight,path] of [['Fraunces',400,'fraunces'],['IBM Plex Sans',400,'ibm-plex-sans'],['IBM Plex Sans',600,'ibm-plex-sans']] as const){
  const font=await readFile(`node_modules/@fontsource/${path}/files/${path}-latin-${weight}-normal.woff2`);
  css+=`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2')}`;
}
const wrap=(body:string)=>`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meeting Coach local layout preview</title><style>${css}</style></head><body>${body}</body></html>`;
const shell=(body:string)=>`<header class="masthead"><a class="wordmark" href="#">Meeting Coach<span class="brand-dot">.</span></a><a href="#">Privacy</a></header><main id="main" class="workspace">${body}</main><footer class="footer"><span>Meeting Coach</span><span>Download your review before leaving.</span></footer>`;
const views={home:renderToStaticMarkup(<Coach mode="demo"/>),results:shell(renderToStaticMarkup(<Results review={review} title="Synthetic couple meeting" clear={()=>{}} headingRef={{current:null}}/>)),waiting:shell(renderToStaticMarkup(<><h1>Your meeting is being reviewed.</h1><section className="submit-section"><WaitingNotice kind="review"/><div className="actions"><button className="primary" disabled>Reviewing · 180s</button><button className="secondary">Cancel</button></div></section><section className="transcript-section"><h2>Example generation</h2><WaitingNotice kind="example"/></section></>))};
await mkdir('tmp/layout',{recursive:true});
await writeFile('tmp/layout/demo-review.json',JSON.stringify({review,metrics:metricRows(review.metrics)}));
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
for(const [view,markup] of Object.entries(views)){
  await writeFile(`tmp/layout/${view}.html`,wrap(markup));
  for(const width of [320,375,414,768,1440]){
    const document=wrap(markup);
    await writeFile(`tmp/layout/${view}-${width}.html`,`<!doctype html><html><head><meta charset="utf-8"><title>Local ${view} preview at ${width}px</title></head><body style="margin:0"><iframe title="Actual app layout at ${width}px; static visual QA only" style="display:block;width:${width}px;height:6000px;border:0" srcdoc="${escape(document)}"></iframe></body></html>`);
  }
  await writeFile(`tmp/layout/${view}-responsive.html`,`<!doctype html><html><head><meta charset="utf-8"><title>Offline ${view}: 320 / 375 / 414 / 768px</title></head><body style="margin:0;font:16px Arial"><div style="display:flex;align-items:flex-start;gap:20px">${[320,375,414,768].map(width=>`<section><p>${width}px · static visual QA</p><iframe title="${view} at ${width}px" style="display:block;width:${width}px;height:4800px;border:0" srcdoc="${escape(wrap(markup))}"></iframe></section>`).join('')}</div></body></html>`);
}
console.log('Offline home/results/waiting previews written to tmp/layout; no interactive or network checks implied.');

// This fixture reports geometry from the browser's own layout engine. It is not hydrated app verification.
const qaFrames=Object.entries(views).flatMap(([view,markup])=>[320,375,414,768].map(width=>`<section><h2>${view} · ${width}px</h2><iframe data-name="${view}-${width}" title="${view} at ${width}px" style="display:block;width:${width}px;height:6500px;border:1px solid" srcdoc="${escape(wrap(markup))}"></iframe></section>`)).join('');
const qaScript=`const frames=[...document.querySelectorAll('iframe')];const results=new Map();function measure(frame){const d=frame.contentDocument,w=frame.contentWindow.innerWidth;const overflow=[...d.body.querySelectorAll('*')].filter(e=>!e.closest('.skip')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>w+1||r.left< -1)}).map(e=>e.tagName+'.'+e.className);const clipped=[...d.querySelectorAll('button,a,select')].filter(e=>e.getBoundingClientRect().width&&e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim());results.set(frame.dataset.name,{width:w,overflow,clipped});document.getElementById('report').textContent=[...results].map(([name,r])=>name+': viewport '+r.width+'px; '+r.overflow.length+' overflowing elements; '+r.clipped.length+' clipped controls'+(r.overflow.length?' ['+r.overflow.join(', ')+']':'')+(r.clipped.length?' ['+r.clipped.join(', ')+']':'')).join('\\n')};frames.forEach(f=>f.addEventListener('load',async()=>{await f.contentDocument.fonts.ready;measure(f)}));`;
await writeFile('tmp/layout/responsive-qa.html',`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Meeting Coach: offline responsive layout check</title></head><body><h1>Actual app markup · responsive geometry</h1><p>Static render only. No server, model call or interaction verification.</p><pre id="report">Loading the twelve layouts…</pre><div style="display:flex;flex-wrap:wrap;align-items:start;gap:24px">${qaFrames}</div><script>${qaScript}</script></body></html>`);

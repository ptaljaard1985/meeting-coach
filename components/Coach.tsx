'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- full navigation releases sensitive in-memory meeting state */
import { useEffect, useRef, useState } from 'react';
import { ACKNOWLEDGEMENT, NOTICE_VERSION, MAX_TRANSCRIPT_BYTES } from '../lib/constants';
import { parseTranscript, skippedSummary, type ParsedTranscript } from '../lib/transcripts';
import { checkRoles } from '../lib/roles';
import { DEMO_TRANSCRIPT } from '../lib/demo-transcript';
import type { MeetingContext, Review, SpeakerRole } from '../lib/types';
import Results from './Results';
import Challenge from './Challenge';
import WaitingNotice from './WaitingNotice';
import type { GeneratedExample } from '../lib/examples/generate';
import type { ScenarioId } from '../lib/examples/prompt';
export default function Coach({mode,siteKey,nonce,analyticsEnabled=true}:{mode:'demo'|'live';siteKey?:string;nonce?:string;analyticsEnabled?:boolean}){
  const [transcript,setTranscript]=useState(''),[parsed,setParsed]=useState<ParsedTranscript|null>(null),[parseError,setParseError]=useState(''),[checking,setChecking]=useState(false);
  const [adviser,setAdviser]=useState(''),[others,setOthers]=useState<Record<string,'client'|'observer'>>({}),[context,setContext]=useState<MeetingContext|''>('');
  const [ack,setAck]=useState(false),[title,setTitle]=useState(''),[duration,setDuration]=useState(''),[review,setReview]=useState<Review|null>(null);
  const [status,setStatus]=useState<'idle'|'generating'|'reviewing'|'preparing'>('idle'),[error,setError]=useState(''),[elapsed,setElapsed]=useState(0),[token,setToken]=useState(''),[challengeReset,setChallengeReset]=useState(0);
  const [exampleInfo,setExampleInfo]=useState<Pick<GeneratedExample,'wordCount'|'durationSeconds'>|null>(null),[previousScenario,setPreviousScenario]=useState<ScenarioId|undefined>(),[exampleError,setExampleError]=useState('');
  const active=useRef<AbortController|null>(null);const generation=useRef(0);const busy=status!=='idle';const resultHeading=useRef<HTMLHeadingElement>(null);
  const clear=()=>{generation.current++;active.current?.abort();active.current=null;setTranscript('');setParsed(null);setParseError('');setAdviser('');setOthers({});setContext('');setAck(false);setTitle('');setDuration('');setReview(null);setError('');setStatus('idle');setChecking(false);setToken('');setChallengeReset(n=>n+1);setExampleInfo(null);setPreviousScenario(undefined);setExampleError('');};
  const clearRef=useRef(clear);useEffect(()=>{clearRef.current=clear;});
  useEffect(()=>{const leave=()=>clearRef.current();const restore=(event:PageTransitionEvent)=>{if(event.persisted)clearRef.current();};window.addEventListener('pagehide',leave);window.addEventListener('pageshow',restore);window.addEventListener('popstate',leave);return()=>{active.current?.abort();window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',restore);window.removeEventListener('popstate',leave);};},[]);
  useEffect(()=>{if(!transcript)return;const timer=setTimeout(()=>{try{setParsed(parseTranscript(transcript));setParseError('');}catch(e){setParsed(null);setParseError(e instanceof Error?e.message:'Check your speaker labels.');}setChecking(false);},250);return()=>clearTimeout(timer);},[transcript]);
  useEffect(()=>{if(!busy)return;const start=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
  useEffect(()=>{if(review)resultHeading.current?.focus();},[review]);
  const roles:SpeakerRole[]=parsed?parsed.speakers.flatMap(s=>{const role=s.name===adviser?'adviser':others[s.name];return role?[{speaker:s.name,role}]:[];}):[];
  let roleError='';if(parsed){try{if(!context)throw new Error('Choose the meeting type.');checkRoles(parsed,roles,context);}catch(e){roleError=(e as Error).message;}}
  const durationValid=duration===''||(Number.isFinite(Number(duration))&&Number(duration)>0&&Number(duration)<=480);
  const valid=!!parsed&&!checking&&!roleError&&ack&&durationValid&&(!siteKey||!!token);
  const edit=(value:string)=>{setTranscript(value);setChecking(!!value);setParseError('');setParsed(null);setAdviser('');setOthers({});setAck(false);setError('');setExampleInfo(null);setExampleError('');};
  const generate=async()=>{
    if(busy||active.current||mode==='demo'||(siteKey&&!token))return;
    const controller=new AbortController();active.current=controller;const current=++generation.current;setError('');setExampleError('');setElapsed(0);setStatus('generating');
    try{
      const response=await fetch('/api/example',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({requestId:crypto.randomUUID(),challengeToken:token||undefined,previousScenario})});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.message??'The example could not be created. Your current transcript is unchanged.');
      const example=data.example as GeneratedExample;parseTranscript(example.transcript);
      if(controller.signal.aborted||generation.current!==current)return;
      edit(example.transcript);setTitle(example.title.slice(0,120));setDuration((example.durationSeconds/60).toFixed(2));setContext('');setPreviousScenario(example.scenarioId);setExampleInfo(example);
      requestAnimationFrame(()=>document.getElementById('transcript')?.focus());
    }catch(e){if(generation.current===current)setExampleError(controller.signal.aborted?'Example generation was cancelled. Your current transcript is unchanged. A provider request already accepted may still be processed.':e instanceof Error?e.message:'The example could not be created. Your current transcript is unchanged.');}
    finally{if(generation.current===current){active.current=null;setStatus('idle');setToken('');setChallengeReset(n=>n+1);}}
  };
  const submit=async()=>{if(!valid||busy||active.current||!context)return;const controller=new AbortController();active.current=controller;const current=++generation.current;setError('');setElapsed(0);setStatus('reviewing');
    try{const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({transcript,roles,context,acknowledgement:ack,noticeVersion:NOTICE_VERSION,requestId:crypto.randomUUID(),challengeToken:token||undefined,knownDurationSeconds:duration?Number(duration)*60:undefined})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message??'The review could not be completed. Please try again.');if(controller.signal.aborted||generation.current!==current)return;setStatus('preparing');setReview(data.review);window.scrollTo({top:0});}
    catch(e){if(generation.current===current)setError(controller.signal.aborted?'The request was cancelled. A provider request already accepted may still be processed.':e instanceof Error?e.message:'Connection failed. Please try again.');}
    finally{if(generation.current===current){active.current=null;setStatus('idle');setToken('');setChallengeReset(n=>n+1);}}
  };
  return <><header className="masthead"><a className="wordmark" href="/">Meeting Coach<span className="brand-dot" aria-hidden="true">.</span></a><a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></header><main id="main" className="workspace">
    {review?<Results review={review} title={title} clear={clear} headingRef={resultHeading}/>:<>
    <div className="intro"><h1>A closer look at your meeting.</h1><p>Review your communication and meeting craft, with evidence from your transcript.</p></div>
    {mode==='demo'&&<div className="notice"><strong>Synthetic preview</strong><span>This preview uses example scores. Load the supplied transcript to try the complete review and PDF flow.</span><button className="text-button" disabled={busy} onClick={()=>edit(DEMO_TRANSCRIPT)}>Load example</button></div>}
    <div className="steps"><section className="step step-transcript"><div className="step-head"><span className="step-number" aria-hidden="true">1</span><div><h2 id="step-transcript">Your transcript</h2><p className="step-lead">Paste it below. It is parsed on your device.</p></div></div>
    <div className="example-controls"><button className="secondary" disabled={busy||mode==='demo'||!!(siteKey&&!token)} onClick={generate} aria-describedby="example-help">{status==='generating'?`Generating example · ${elapsed}s`:'Generate example meeting'}</button>{status==='generating'&&<button className="text-button" onClick={()=>active.current?.abort()}>Cancel example</button>}<span>45–55 minutes · fictional</span></div>
    <p id="example-help" className="helper">{mode==='demo'?'AI examples become available when live mode is configured. The short preview example is available above.':siteKey&&!token?'Complete the verification in step 3 to generate a fresh example. Your pasted text is not sent.':'Creates a fresh AI example and replaces the text below. Your pasted text is not sent.'}</p>
    {status==='generating'&&<WaitingNotice kind="example"/>}
    {exampleError&&<p className="error" role="alert">{exampleError}</p>}
    {exampleInfo&&<p className="example-loaded" role="status">Fictional couple meeting · {Math.round(exampleInfo.durationSeconds/60)} minutes · {exampleInfo.wordCount.toLocaleString()} spoken words. Timestamps simulate speech at 140 words per minute. Confirm the speakers and context to review it.</p>}
    <textarea id="transcript" aria-labelledby="step-transcript" rows={17} disabled={busy} value={transcript} onChange={e=>edit(e.target.value)} placeholder={'Adviser: Before we start, how have things been?\nClient: The change at work has been difficult.\nAdviser: What has felt most difficult?'} aria-describedby="transcript-help parse-status" aria-invalid={!!parseError} spellCheck={false} autoComplete="off"/>
    <p id="transcript-help" className="helper">Speaker blocks, Name: text, or speaker-labelled VTT/SRT, up to {MAX_TRANSCRIPT_BYTES/1000} KB (roughly three hours). Remove unnecessary names, account numbers and other identifiers.</p>
    <div id="parse-status" className={parseError?'error':'parse-status'} aria-live="polite">{checking?'Checking input locally…':parseError|| (parsed?`${parsed.speakers.length} speakers · ${parsed.totalWords.toLocaleString()} words · ${parsed.hasTimestamps?'timestamps found':'no timestamps; word-based estimates'}${skippedSummary(parsed.skipped)?` · ${skippedSummary(parsed.skipped)}`:''}`:'Nothing is sent when you paste.')}</div>
    </section><section className="step step-context"><div className="step-head"><span className="step-number" aria-hidden="true">2</span><div><h2 id="step-context">Meeting context</h2><p className="step-lead">Tell us who is speaking. Names and generic speaker labels both work.</p></div></div>
    <div className="context-grid"><div className="context-col"><label htmlFor="adviser">Which speaker is the adviser?</label><select id="adviser" value={adviser} disabled={!parsed||checking||busy} onChange={e=>{setAdviser(e.target.value);setOthers({});setAck(false);}}><option value="">Select the adviser</option>{parsed?.speakers.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}</select>
    {adviser&&parsed?.speakers.filter(s=>s.name!==adviser).map(s=><div className="speaker-role" key={s.name}><label htmlFor={`role-${parsed.speakers.indexOf(s)}`}>{s.name}</label><select id={`role-${parsed.speakers.indexOf(s)}`} value={others[s.name]??''} disabled={busy} onChange={e=>{setOthers(v=>({...v,[s.name]:e.target.value as 'client'|'observer'}));setAck(false);}}><option value="">Confirm role</option><option value="client">Client</option><option value="observer">Assistant / observer</option></select></div>)}
    </div><div className="context-col"><label htmlFor="context">Meeting type</label><select id="context" value={context} disabled={busy} onChange={e=>{setContext(e.target.value as MeetingContext);setAck(false);}}><option value="">Select the meeting type</option><option value="single">One client</option><option value="couple">A couple (two clients)</option><option value="couple_shared">A couple on one device (one shared label)</option><option value="other">Other client meeting</option></select>
    <div className="optional"><label htmlFor="title">Meeting title <span>optional · stays local</span></label><input id="title" autoComplete="off" disabled={busy} value={title} maxLength={120} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Annual review"/>
    <label htmlFor="duration">Known duration <span>optional · minutes</span></label><input id="duration" type="number" min="0.1" max="480" step="0.1" disabled={busy} value={duration} onChange={e=>setDuration(e.target.value)} placeholder="e.g. 45" aria-invalid={!durationValid}/>{!durationValid&&<p className="error">Enter a duration between 0 and 480 minutes.</p>}</div></div></div>
    {parsed&&roleError&&<p className="helper">{roleError}</p>}
    </section><section className="step step-confirm"><div className="step-head"><span className="step-number" aria-hidden="true">3</span><div><h2 id="step-confirm">Confirm and review</h2></div></div>
    <label className="acknowledgement"><input type="checkbox" checked={ack} disabled={busy} onChange={e=>setAck(e.target.checked)}/><span>{ACKNOWLEDGEMENT}</span></label>
    <p className="disclosure">Your transcript is sent through our server to OpenAI to create your review. Meeting Coach does not save transcript text, quotes or written reviews.{analyticsEnabled&&' We keep numerical scores and usage statistics until the operator deletes them.'} OpenAI’s own data-handling terms apply. Download your review before closing or refreshing this page. <a href="/privacy" target="_blank" rel="noreferrer">Read the privacy details</a>.</p>
    {mode==='demo'&&<p className="helper">In this synthetic preview, the example is checked by the local app server. No transcript is sent to OpenAI.</p>}
    {siteKey&&<Challenge siteKey={siteKey} nonce={nonce} onToken={setToken} reset={challengeReset}/>}
    <div className="actions"><button className="primary" disabled={!valid||busy} onClick={submit}>{status==='reviewing'?`Reviewing · ${elapsed}s`:status==='preparing'?'Preparing results…':'Review meeting'}<span aria-hidden="true"> →</span></button>{busy&&status!=='generating'?<button className="secondary" onClick={()=>active.current?.abort()}>Cancel</button>:<button className="text-button" disabled={busy||!transcript} onClick={clear}>Clear</button>}<span className="helper">Adviser coaching only. AI judgment can vary.</span></div>
    {(status==='reviewing'||status==='preparing')&&<WaitingNotice kind={status==='reviewing'?'review':'preparing'}/>}{error&&<p className="error" role="alert">{error}</p>}
    </section></div></>}
  </main><footer className="footer"><span>Meeting Coach</span><span>Communication &amp; meeting craft</span><span>Coaching, not a compliance certificate or client advice.</span></footer></>;
}

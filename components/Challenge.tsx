'use client';
import { useEffect, useRef } from 'react';
import Script from 'next/script';
declare global { interface Window { turnstile?: {render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void} } }
export default function Challenge({siteKey,nonce,onToken,reset}:{siteKey:string;nonce?:string;onToken:(token:string)=>void;reset:number}){
  const element=useRef<HTMLDivElement>(null);const widget=useRef<string|undefined>(undefined);const callback=useRef(onToken);
  useEffect(()=>{callback.current=onToken;},[onToken]);
  const render=()=>{if(!element.current||!window.turnstile||widget.current)return;widget.current=window.turnstile.render(element.current,{sitekey:siteKey,action:'review',size:'flexible',callback:(t:string)=>callback.current(t),'expired-callback':()=>callback.current(''),'error-callback':()=>callback.current('')});};
  useEffect(()=>{if(widget.current){window.turnstile?.remove(widget.current);widget.current=undefined;}if(element.current&&window.turnstile)widget.current=window.turnstile.render(element.current,{sitekey:siteKey,action:'review',size:'flexible',callback:(t:string)=>callback.current(t),'expired-callback':()=>callback.current(''),'error-callback':()=>callback.current('')});return()=>{if(widget.current)window.turnstile?.remove(widget.current);widget.current=undefined;};},[reset,siteKey]);
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" nonce={nonce} strategy="afterInteractive" onReady={render}/><div ref={element} aria-label="Submission verification"/></>;
}

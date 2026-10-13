// @vitest-environment happy-dom
import React,{ act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import Coach from '../../components/Coach';
import { DEMO_TRANSCRIPT } from '../../lib/demo-transcript';

let root:Root,host:HTMLDivElement;
let fetchMock:ReturnType<typeof vi.fn<typeof fetch>>;
let localWrite:ReturnType<typeof vi.fn>,sessionWrite:ReturnType<typeof vi.fn>;
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(label))!;
const textarea=()=>host.querySelector('textarea')!;
const settle=()=>new Promise(resolve=>setTimeout(resolve,300));
// Short response fixture tests client state only; full-length constraints are tested in examples.test.ts.
const example=(scenarioId='career')=>({transcript:DEMO_TRANSCRIPT.replace('The change at work','This fictional career change at work'),title:'Synthetic: Fresh household',durationSeconds:3000,wordCount:7000,scenarioId,exampleId:crypto.randomUUID(),synthetic:true});

beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);fetchMock=vi.fn<typeof fetch>();vi.stubGlobal('fetch',fetchMock);localWrite=vi.fn();sessionWrite=vi.fn();vi.stubGlobal('localStorage',{setItem:localWrite,getItem:()=>null});vi.stubGlobal('sessionStorage',{setItem:sessionWrite,getItem:()=>null});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function seedAndEnable(){
  await act(async()=>root.render(<Coach mode="demo"/>));
  await act(async()=>button('Load example').click());
  await act(async()=>{await settle();});
  await act(async()=>root.render(<Coach mode="live"/>));
  expect(textarea().value).toBe(DEMO_TRANSCRIPT);
}

it('generates through a content-free request and replaces text only after success',async()=>{
  await seedAndEnable();const fresh=example();fetchMock.mockResolvedValueOnce(Response.json({example:fresh}));
  await act(async()=>button('Generate example meeting').click());
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url,options]=fetchMock.mock.calls[0];expect(url).toBe('/api/example');
  const body=JSON.parse(options!.body as string);expect(Object.keys(body)).toEqual(['requestId']);expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(options?.cache).toBe('no-store');expect(options?.body).not.toContain('Before we look at the numbers');
  expect(textarea().value).toBe(fresh.transcript);expect(host.textContent).toContain('Timestamps simulate speech');
  expect((host.querySelector('#adviser') as HTMLSelectElement).value).toBe('');expect((host.querySelector('input[type=checkbox]') as HTMLInputElement).checked).toBe(false);
  fetchMock.mockResolvedValueOnce(Response.json({example:example('retirement')}));
  await act(async()=>button('Generate example meeting').click());
  const next=JSON.parse(fetchMock.mock.calls[1][1]!.body as string);expect(next.previousScenario).toBe('career');expect(next.requestId).not.toBe(body.requestId);
});
it('preserves the paste and shows a nearby error when generation fails',async()=>{
  await seedAndEnable();fetchMock.mockResolvedValue(Response.json({error:{message:'Example service unavailable; try later.'}},{status:503}));
  await act(async()=>button('Generate example meeting').click());
  expect(textarea().value).toBe(DEMO_TRANSCRIPT);expect(host.querySelector('[role=alert]')?.textContent).toContain('try later');expect(button('Generate example meeting').disabled).toBe(false);
});
it('cancels a request without replacing text or accepting a late response',async()=>{
  await seedAndEnable();let finish!:(r:Response)=>void;
  fetchMock.mockImplementation((_url,options)=>new Promise((resolve,reject)=>{finish=resolve;options?.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});}));
  await act(async()=>button('Generate example meeting').click());expect(textarea().disabled).toBe(true);expect(button('Generating example').disabled).toBe(true);
  expect(host.querySelector('.waiting-notice')?.getAttribute('role')).toBe('status');expect(host.querySelector('.waiting-notice')?.textContent).toContain('Do not refresh, close the tab or leave this page');
  await act(async()=>button('Cancel example').click());
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);expect(host.querySelector('[role=alert]')?.textContent).toContain('cancelled');expect(textarea().value).toBe(DEMO_TRANSCRIPT);
  expect(host.querySelector('.waiting-notice')).toBeNull();
  await act(async()=>finish(Response.json({example:example()})));expect(textarea().value).toBe(DEMO_TRANSCRIPT);
});
it('shows a waiting notice during a review and keeps cancellation available',async()=>{
  await seedAndEnable();
  const select=async(label:string,value:string)=>{await act(async()=>{const l=Array.from(host.querySelectorAll('label')).find(l=>l.textContent?.trim()===label)!;const field=document.getElementById(l.htmlFor) as HTMLSelectElement;field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));});};
  await select('Which speaker is the adviser?','Adviser');await select('Client A','client');await select('Client B','client');await select('Meeting type','couple');
  await act(async()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  fetchMock.mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true})));
  expect(button('Review meeting').disabled).toBe(false);await act(async()=>button('Review meeting').click());
  expect(host.querySelector('.waiting-notice')?.textContent).toContain('Reviewing your meeting');expect(host.querySelector('.waiting-notice')?.textContent).toContain('Please wait and keep this page open');expect(button('Cancel').disabled).toBe(false);expect(textarea().disabled).toBe(true);
  await act(async()=>button('Cancel').click());expect(host.querySelector('.waiting-notice')).toBeNull();expect(textarea().value).toBe(DEMO_TRANSCRIPT);
});
it('navigation clears an active generation and prevents restored content',async()=>{
  await seedAndEnable();let finish!:(r:Response)=>void;fetchMock.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>button('Generate example meeting').click());
  await act(async()=>window.dispatchEvent(new Event('pagehide')));expect(textarea().value).toBe('');
  await act(async()=>finish(Response.json({example:example()})));expect(textarea().value).toBe('');expect(host.textContent).not.toContain('Fictional couple meeting');
  expect(localWrite).not.toHaveBeenCalled();expect(sessionWrite).not.toHaveBeenCalled();
});
it('clearly disables paid generation in the offline preview',async()=>{
  await act(async()=>root.render(<Coach mode="demo"/>));expect(button('Generate example meeting').disabled).toBe(true);expect(host.textContent).toContain('live mode is configured');
  await act(async()=>button('Generate example meeting').click());expect(fetchMock).not.toHaveBeenCalled();
});

import { afterEach,it,expect,vi } from 'vitest';
import { REVIEW_TIMEOUT_MS } from '../../lib/constants';
import { getConfig } from '../../lib/server/config';
import { judge,type Provider } from '../../lib/review/judge';
import { generateExample } from '../../lib/examples/generate';
import { config,prepared,provider } from './helpers';

afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
it('defaults to fifteen minutes and rejects unsupported or unbounded timeouts',()=>{
  expect(getConfig({NODE_ENV:'development'}).timeout).toBe(900000);
  for(const value of ['0','-1','NaN','900001','Infinity'])expect(()=>getConfig({NODE_ENV:'development',REVIEW_TIMEOUT_MS:value})).toThrow();
});
it.each(['review','example'])('%s waits beyond former app/SDK limits but shares one fifteen-minute deadline across corrections',async kind=>{
  vi.useFakeTimers();vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{const controller=new AbortController();setTimeout(()=>controller.abort(new DOMException('Timed out','TimeoutError')),ms);return controller.signal;});
  const send=vi.fn<Provider>().mockImplementationOnce(async()=>{await new Promise(resolve=>setTimeout(resolve,14*60*1000));return provider({})({} as never,new AbortController().signal);}).mockImplementation(()=>new Promise(()=>{}));
  const reserve=vi.fn(async()=>{});const parent=new AbortController().signal;
  const pending=(kind==='review'?judge(prepared(),config(),send,reserve,parent):generateExample({requestId:crypto.randomUUID()},REVIEW_TIMEOUT_MS,send,reserve,parent)).then(()=>null,e=>e);
  await vi.advanceTimersByTimeAsync(10*60*1000+1);expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][1].aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(4*60*1000);expect(send).toHaveBeenCalledTimes(2);expect(reserve).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60*1000);expect(await pending).toMatchObject({code:'timeout'});expect(send.mock.calls[1][1].aborted).toBe(true);expect(send).toHaveBeenCalledTimes(2);
});

import { MAX_BODY_BYTES, MAX_TRANSCRIPT_BYTES } from '../constants';
import { SafeError } from './errors';
export async function readBoundedJson(request:Request,maxBytes=MAX_BODY_BYTES){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new SafeError(415,'format','Submit the transcript as JSON.');
  if(!request.body)throw new SafeError(400,'input','No transcript was received.');
  const reader=request.body.getReader();let size=0;let raw='';const decoder=new TextDecoder('utf-8',{fatal:true});
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10000)]);
  const onAbort=()=>{void reader.cancel();};signal.addEventListener('abort',onAbort,{once:true});
  try{while(true){if(signal.aborted)throw new SafeError(408,'body_timeout','The upload took too long. Please try again.');const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new SafeError(413,'size',maxBytes===MAX_BODY_BYTES?`The transcript is too large. Use an excerpt of up to ${MAX_TRANSCRIPT_BYTES/1000} KB.`:'The example request is too large.');}raw+=decoder.decode(value,{stream:true});}if(signal.aborted)throw new SafeError(408,'body_timeout','The upload took too long. Please try again.');raw+=decoder.decode();return JSON.parse(raw) as unknown;}
  catch(e){if(e instanceof SafeError)throw e;throw new SafeError(400,'input','The submission could not be read. Please check it and try again.');}
  finally{signal.removeEventListener('abort',onAbort);reader.releaseLock();}
}

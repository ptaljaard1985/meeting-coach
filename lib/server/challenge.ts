import type { Config } from './config';
import { SafeError } from './errors';
export async function verifyChallenge(token:string|undefined,config:Config,signal:AbortSignal,send:typeof fetch=fetch){
  if(!config.production&&!config.challengeSecret)return;
  if(!token||!config.challengeSecret)throw new SafeError(400,'challenge','Complete the verification and try again.');
  try {const response=await send('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.challengeSecret,response:token}),signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),cache:'no-store'});
    const result=await response.json();if(!response.ok||result.success!==true||result.action!=='review'||result.hostname!==new URL(config.origin!).hostname)throw new Error();
  }catch{throw new SafeError(400,'challenge','Verification expired or could not be checked. Refresh the verification and try again.');}
}

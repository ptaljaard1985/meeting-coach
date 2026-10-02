import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request:NextRequest){
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');const development=process.env.NODE_ENV!=='production';
  const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${development?"'unsafe-eval'":''} https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com ${development?'ws:':''}; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; ${development?'':'upgrade-insecure-requests;'}`;
  const headers=new Headers(request.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
  const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',csp);response.headers.set('Cache-Control','no-store, max-age=0');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');if(!development)response.headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};

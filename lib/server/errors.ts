export class SafeError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export const unavailable=()=>new SafeError(503,'unavailable','Live reviews are unavailable at the moment. Your transcript is still here; try again later.');

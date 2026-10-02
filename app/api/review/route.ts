import { handleReview } from '../../../lib/server/handler';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Fifteen minutes of processing, plus room for upload and request cleanup.
export const maxDuration=960;
export async function POST(request:Request){return handleReview(request);}

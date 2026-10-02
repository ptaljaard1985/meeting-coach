import { handleExample } from '../../../lib/server/example-handler';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=960;
export async function POST(request:Request){return handleExample(request);}

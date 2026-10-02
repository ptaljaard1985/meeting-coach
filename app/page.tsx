import Coach from '../components/Coach';
import { headers } from 'next/headers';
import { getAnalyticsSettings } from '../lib/analytics';
export const dynamic='force-dynamic';
export default async function Home(){const h=await headers();return <Coach mode={process.env.REVIEW_MODE==='live'?'live':'demo'} siteKey={process.env.TURNSTILE_SITE_KEY} nonce={h.get('x-nonce')??undefined} analyticsEnabled={getAnalyticsSettings().enabled}/>;}

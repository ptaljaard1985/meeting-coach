import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Meeting Coach',description:'Review your communication and meeting craft with evidence from your transcript.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en-GB"><body><a className="skip" href="#main">Skip to content</a>{children}</body></html>;}

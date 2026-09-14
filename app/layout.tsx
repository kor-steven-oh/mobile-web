import type {Metadata,Viewport} from 'next';
import {headers} from 'next/headers';
import './globals.css';
export async function generateMetadata():Promise<Metadata>{
 const h=await headers();
 const origin=`${h.get('x-forwarded-proto')||'http'}://${h.get('host')||'localhost:3000'}`;
 const title='SDD 2026 · S.LSI Developer Day';
 const description='개발자의 아이디어가 더 밝은 내일로. SDD 2026 프로그램과 이벤트를 만나보세요.';
 return {title,description,metadataBase:new URL(origin),openGraph:{title,description,images:[{url:'/og.png',width:1536,height:1024,alt:'SDD 2026 · Developers make a brighter tomorrow.'}],locale:'ko_KR',type:'website'},twitter:{card:'summary_large_image',title,description,images:['/og.png']}};
}
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f7f9fb'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>;}

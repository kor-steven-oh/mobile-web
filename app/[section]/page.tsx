import {notFound} from 'next/navigation';
import ConferenceApp from '../conference-app';
export default async function Page({params}:{params:Promise<{section:string}>}) {
 const {section}=await params;
 if(!['home','program','event','mypage','speakers'].includes(section)) notFound();
 return <ConferenceApp page={section}/>;
}

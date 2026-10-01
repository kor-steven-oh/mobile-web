import { authenticate, cookie, login, logout } from './auth';
import { listNfcTags, listPreRegistrationGifts, updatePreRegistrationGift, AdminError, listUsers, resetUser, userDetail, type ResetAction } from '../db/admin';

const json = (value: unknown, status = 200, extra: Record<string,string> = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
async function input(request: Request): Promise<Record<string,unknown>> {
  const reader=request.body?.getReader();
  if (!reader) throw new AdminError('입력값이 필요합니다.');
  const bytes:number[]=[];
  while(true){ const {done,value}=await reader.read(); if(done) break;
    if(bytes.length+value.length>2048){await reader.cancel();throw new AdminError('입력값이 너무 깁니다.',413);} bytes.push(...value);
  }
  try { const data:unknown=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))); if(data&&typeof data==='object'&&!Array.isArray(data))return data as Record<string,unknown>; } catch {}
  throw new AdminError('입력값을 확인해주세요.');
}
const adminWorker = {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/admin/api/')) url.pathname=url.pathname.slice('/admin'.length);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(!['GET','POST'].includes(request.method)) return json({error:'지원하지 않는 요청입니다.'},405);
    if(request.method==='POST'&&request.headers.get('origin')!==url.origin) return json({error:'잘못된 요청입니다.'},403);
    try {
      if(url.pathname==='/api/login'&&request.method==='POST') {
        const data=await input(request);
        if(typeof data.password!=='string'||data.password.length>200)return json({error:'비밀번호를 확인해주세요.'},400);
        const result=await login(env.DB,data.password,env.ADMIN_PASSWORD_HASH,request.headers.get('cf-connecting-ip')||'local');
        if('error' in result)return json({error:result.error},result.status);
        return json({authenticated:true},200,{'Set-Cookie':cookie(request,result.token)});
      }
      const admin=await authenticate(env.DB,request);
      if(url.pathname==='/api/session'&&request.method==='GET')return json({authenticated:Boolean(admin)});
      if(!admin)return json({error:'관리자 로그인이 필요합니다.'},401);
      if(url.pathname==='/api/logout'&&request.method==='POST'){await logout(env.DB,request);return json({authenticated:false},200,{'Set-Cookie':cookie(request,'',true)});}
      if(url.pathname==='/api/nfc-tags'&&request.method==='GET')return json({tags:await listNfcTags(env.DB)});
      if(url.pathname==='/api/pre-registration-gifts') {
        if(request.method==='GET') return json(await listPreRegistrationGifts(env.DB,(url.searchParams.get('q')||'').slice(0,80),Number(url.searchParams.get('page')||1)));
        const data=await input(request);
        if(typeof data.phone!=='string'||data.phone.length>30||typeof data.action!=='string')throw new AdminError('전화번호와 등록 또는 삭제 항목을 확인해주세요.');
        return json(await updatePreRegistrationGift(env.DB,data.phone,data.action));
      }
      if(url.pathname==='/api/users'&&request.method==='GET') {
        const page=Number(url.searchParams.get('page')||1);
        if(!Number.isInteger(page)||page<1||page>100000)return json({error:'페이지를 확인해주세요.'},400);
        return json(await listUsers(env.DB,(url.searchParams.get('q')||'').slice(0,80),page));
      }
      const match=/^\/api\/users\/([a-zA-Z0-9-]+)(\/reset)?$/.exec(url.pathname);
      if(match&&!match[2]&&request.method==='GET')return json(await userDetail(env.DB,match[1]));
      if(match?.[2]&&request.method==='POST') {
        const data=await input(request);
        if(typeof data.action!=='string')throw new AdminError('초기화 항목을 선택해주세요.');
        return json(await resetUser(env.DB,match[1],admin.id,{action:data.action as ResetAction,slot:typeof data.slot==='number'?data.slot:undefined}));
      }
      return json({error:'요청을 찾을 수 없습니다.'},404);
    } catch(cause) {
      if(cause instanceof AdminError)return json({error:cause.message},cause.status);
      return json({error:'요청을 처리하지 못했습니다. 다시 시도해주세요.'},503);
    }
  },
};

export default adminWorker;

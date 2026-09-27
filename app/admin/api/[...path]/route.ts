import adminWorker from '../../../../admin/worker';

async function handle(request: Request) {
  const { env } = await import('cloudflare:workers');
  if (!env.DB) return Response.json({ error: '데이터베이스 연결을 확인해주세요.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return adminWorker.fetch(request, { ...env, DB: env.DB });
}

export { handle as GET, handle as POST };

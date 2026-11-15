import { logout, naverCallback, naverLogin } from './auth/naver.ts'
import { type Env, redact } from './config.ts'
import { flightsApi } from './flight/flights.ts'
import { historyApi } from './history/api.ts'
import { profileApi } from './profile/api.ts'
import { recommendApi } from './recommend/api.ts'
import { seatMapApi, seatMapListApi } from './seatmap/api.ts'

/**
 * 서버의 입구. 화면이 부르는 창구를 주소로 고른다.
 * Cloudflare는 /api/* 요청만 여기로 보내고, 나머지 주소는 화면 파일(dist/)이 답한다 (wrangler.jsonc).
 */
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method === 'HEAD' ? 'GET' : request.method
  // GET이 아닌 창구는 이 둘뿐이다
  const allowed = path === '/api/profile' || path === '/api/history' ? ['GET', 'PUT'] : path === '/api/auth/logout' ? ['POST'] : ['GET']
  if (!allowed.includes(method)) return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  try {
    if (path === '/api/auth/naver') return await naverLogin(request, env)
    if (path === '/api/auth/naver/callback') return await naverCallback(request, env)
    if (path === '/api/auth/logout') return logout()
    if (path === '/api/profile') return await profileApi(request, env, Date.now())
    if (path === '/api/history') return await historyApi(request, env, Date.now())
    if (path === '/api/flights') return await flightsApi(url.searchParams, env, Date.now())
    if (path === '/api/recommend') return await recommendApi(url.searchParams, env, Date.now())
    if (path === '/api/seatmaps') return seatMapListApi()
    const seatMapId = /^\/api\/seatmaps\/([^/]+)$/.exec(path)
    if (seatMapId) return seatMapApi(decode(seatMapId[1]))
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  } catch (e) {
    console.error(redact(`창구에서 오류가 났어요: ${e instanceof Error ? e.stack : e}`, env))
    return Response.json({ error: 'INTERNAL' }, { status: 500 })
  }
}

/** 주소 한 마디의 % 표기를 푼다. 풀 수 없는 표기면 null. */
function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

export default { fetch: handle }

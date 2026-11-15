import { type Env, redact } from './config.ts'
import { flightsApi } from './flight/flights.ts'
import { recommendApi } from './recommend/api.ts'
import { seatMapApi, seatMapListApi } from './seatmap/api.ts'

/**
 * 서버의 입구. 화면이 부르는 창구를 주소로 고른다.
 * Cloudflare는 /api/* 요청만 여기로 보내고, 나머지 주소는 화면 파일(dist/)이 답한다 (wrangler.jsonc).
 */
export async function handle(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD')
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 })
  try {
    const url = new URL(request.url)
    const path = url.pathname
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

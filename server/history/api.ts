import { sessionUser } from '../auth/naver.ts'
import type { Env } from '../config.ts'
import { readHistory } from './rules.ts'

/**
 * 검색 · 여행 기록 — GET · PUT /api/history. 로그인해야 쓸 수 있다 (아니면 401 NOT_LOGGED_IN).
 * 보관함은 취향과 같은 KV(PROFILES): 열쇠는 `history:<계정 id>`, 값은 기록 JSON.
 *  - GET → { history: 기록 | null } (아직 저장한 적이 없으면 null)
 *  - PUT 몸통 = { searches, picks, trips } 세 배열, 각 30개 이하, 최신이 맨 앞. 전체를 통째로 바꿔 쓴다.
 *    칸 규칙은 ./rules.ts가 기준 (공항 GMP · CJU · PUS, 인원은 src/booking.ts isBookable과 같게).
 *    틀린 칸이 하나라도 있으면 400 INVALID_HISTORY (고쳐 쓰지 않는다), 맞으면 모르는 칸은 버리고 204.
 */
export async function historyApi(request: Request, env: Env, now: number): Promise<Response> {
  const id = await sessionUser(request, env, now)
  if (id === null || !env.PROFILES) return Response.json({ error: 'NOT_LOGGED_IN' }, { status: 401 })
  const key = `history:${id}`
  if (request.method === 'PUT') {
    const { history, clean } = readHistory(await request.json().catch(() => null))
    if (!clean) return Response.json({ error: 'INVALID_HISTORY' }, { status: 400 })
    await env.PROFILES.put(key, JSON.stringify(history))
    return new Response(null, { status: 204 })
  }
  const saved = await env.PROFILES.get(key)
  return Response.json({ history: saved === null ? null : JSON.parse(saved) })
}

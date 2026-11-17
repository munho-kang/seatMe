import { nicknameOf } from '../auth/email.ts'
import { sessionUser } from '../auth/naver.ts'
import type { Env } from '../config.ts'
import { POSITION_WEIGHT } from '../recommend/scorer.ts'

const LEVELS = ['sunlight', 'quietness', 'turbulence', 'quickExit', 'view'] as const

/**
 * 내 좌석 취향 — GET · PUT /api/profile. 로그인해야 쓸 수 있다 (아니면 401 NOT_LOGGED_IN).
 * 보관함은 PROFILES(D1 표 kv, config.ts d1Store): 열쇠는 계정 id(네이버 id 또는 이메일 계정 id), 값은 취향 JSON.
 *  - GET → { profile: 취향 | null, nickname: 이메일 계정 닉네임 | null } (저장한 적이 없으면 profile null, 네이버 계정이면 nickname null)
 *  - PUT 몸통 = 취향 6칸 { seatPosition, sunlight, quietness, turbulence, quickExit, view }.
 *    칸 규칙은 /api/recommend와 같다 (seatPosition 5가지 중 하나, 나머지는 1~5 정수). 틀리면 400 INVALID_PROFILE, 맞으면 204.
 */
export async function profileApi(request: Request, env: Env, now: number): Promise<Response> {
  const id = await sessionUser(request, env, now)
  if (id === null || !env.PROFILES) return Response.json({ error: 'NOT_LOGGED_IN' }, { status: 401 })
  if (request.method === 'PUT') {
    const profile = validProfile(await request.json().catch(() => null))
    if (profile === null) return Response.json({ error: 'INVALID_PROFILE' }, { status: 400 })
    await env.PROFILES.put(id, JSON.stringify(profile))
    return new Response(null, { status: 204 })
  }
  const [saved, nickname] = await Promise.all([env.PROFILES.get(id), nicknameOf(id, env)])
  return Response.json({ profile: saved === null ? null : JSON.parse(saved), nickname })
}

/** 6칸이 모두 맞으면 그 6칸만 담은 새 값, 하나라도 틀리면 null (모르는 칸은 버린다). */
export function validProfile(body: unknown): Record<string, string | number> | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (typeof b.seatPosition !== 'string' || !POSITION_WEIGHT.has(b.seatPosition)) return null
  const profile: Record<string, string | number> = { seatPosition: b.seatPosition }
  for (const name of LEVELS) {
    const value = b[name]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) return null
    profile[name] = value
  }
  return profile
}

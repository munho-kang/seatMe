import { config, encodeKey, type Env, fetchPublicData, redact } from '../config.ts'
import { compact, fromCompact, kst } from '../kst.ts'

/** sky: 1 맑음 · 3 구름많음 · 4 흐림. pty: 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기. announced: 그 예보를 발표한 시각 (epoch ms). */
export type Forecast = { sky: number; pty: number; announced: number }

/**
 * 공항의 예보 격자 {nx, ny}. 단기예보는 위경도가 아니라 5km 격자 번호로 묻는다.
 * sun.ts AIRPORTS의 좌표를 포털 문서의 변환식(Lambert 정각원추)에 넣어 구했다. 공항을 늘리면 같은 식으로 구해 넣는다.
 */
export const GRID = new Map<string, [number, number]>([
  ['GMP', [57, 126]], // 김포
  ['CJU', [52, 38]], // 제주
  ['PUS', [95, 76]], // 김해
])

/** 예보는 발표 4~5일 뒤 자정까지만 나온다 (2026-11-11 측정). 이보다 먼 비행은 묻지 않는다. */
export const RANGE_MS = 5 * 24 * 3600_000
/** 예보 간격은 1시간이고 사흘쯤 뒤부터 3시간이다. 가장 가까운 예보가 이보다 멀면 예보가 없는 것으로 본다. */
export const MAX_GAP_MS = 90 * 60_000
/** 발표(02시부터 3시간마다) 뒤 이만큼 지나야 받을 수 있다 (문서로는 10분). */
export const PUBLISH_DELAY_MS = 15 * 60_000

// 공공데이터 답은 모양을 믿을 수 없어 칸마다 확인하며 읽는다
// oxlint-disable-next-line typescript/no-explicit-any
type Json = any

/**
 * 기상청 단기예보에 묻는다: 공항 + 시각 → 그때의 하늘 상태와 강수.
 * 문서: https://www.data.go.kr/data/15084084/openapi.do
 * when · now는 epoch ms. 그 공항 · 그 시각에 가장 가까운 예보를 돌려준다.
 * 예보가 없거나 기상청이 제대로 답하지 않으면 던지지 않고 null을 준다. 날씨는 추천에 붙는 설명 한 줄일 뿐이라 기상청이 죽어도 추천은 나가야 한다.
 * 결과를 저장하지 않는다 (볼 때마다 새 예보).
 */
export async function forecast(env: Env, airport: string, when: number, now: number): Promise<Forecast | null> {
  const key = encodeKey(env.KMA_SERVICE_KEY)
  const grid = GRID.get(airport)
  if (key === '') {
    console.warn('기상청 인증키가 비어 있어요. .dev.vars 에 KMA_SERVICE_KEY=발급받은키 를 넣어 주세요. 키가 없으면 추천에 날씨 한 줄이 붙지 않아요.')
    return null
  }
  if (grid === undefined || when > now + RANGE_MS) return null
  // 가장 최근 발표 시각: 02 · 05 · 08 · 11 · 14 · 17 · 20 · 23시 (한국 시각)
  const ready = now - PUBLISH_DELAY_MS
  const back = ready - ((Number(kst(ready).slice(11, 13)) + 1) % 3) * 3600_000
  const announced = back - (back % 3600_000) // 정각으로 내린다 (한국 시각과 UTC는 정확히 9시간 차이라 분 · 초가 같다)
  // 한 번에 1,000줄쯤 온다 (모든 시각 × 기온 · 바람 등 14종류). 종류나 시각으로 골라 받는 방법은 없다.
  const url = config.kmaBaseUrl + '/getVilageFcst?serviceKey=' + key
    + '&dataType=JSON&numOfRows=2000&pageNo=1'
    + '&base_date=' + compact(announced).slice(0, 8) + '&base_time=' + compact(announced).slice(8, 12)
    + '&nx=' + grid[0] + '&ny=' + grid[1]
  try {
    const root: Json = JSON.parse((await fetchPublicData(url, config.kmaTimeoutMs, 2)).body)
    const header = root?.response?.header
    if (String(header?.resultCode ?? '') !== '00') {
      console.warn(redact(`기상청 오류 응답 → 날씨 한 줄만 뺀다: ${header?.resultCode ?? ''} ${header?.resultMsg ?? ''}`, env))
      return null
    }
    // 예보 시각 → [SKY, PTY]
    const slots = new Map<number, [number, number]>()
    const items = root.response.body?.items?.item
    for (const item of Array.isArray(items) ? items : []) {
      const category = String(item?.category ?? '')
      if (category !== 'SKY' && category !== 'PTY') continue
      const at = fromCompact(String(item.fcstDate ?? '') + String(item.fcstTime ?? ''))
      const value = String(item.fcstValue ?? '')
      if (Number.isNaN(at) || !/^[+-]?\d+$/.test(value)) throw new Error('예보 칸을 읽을 수 없다: ' + category)
      const slot = slots.get(at) ?? [0, 0]
      slot[category === 'SKY' ? 0 : 1] = Number(value)
      slots.set(at, slot)
    }
    // when에 가장 가까운 예보 시각. 같은 거리면 이른 쪽
    let nearest: [number, [number, number]] | null = null
    for (const slot of [...slots].sort((a, b) => a[0] - b[0]))
      if (nearest === null || Math.abs(slot[0] - when) < Math.abs(nearest[0] - when)) nearest = slot
    if (nearest === null || Math.abs(nearest[0] - when) > MAX_GAP_MS) return null
    return { sky: nearest[1][0], pty: nearest[1][1], announced }
  } catch (e) { // 시간 초과, JSON이 아닌 응답, 모르는 칸 모양
    // JSON 오류 문구에는 답의 앞머리가 들어 있어 그대로 남기지 않는다 (인증키 조각이 섞일 수 있다)
    console.warn(redact('기상청 예보 실패 → 날씨 한 줄만 뺀다: ' + (e instanceof SyntaxError ? 'JSON이 아닌 응답' : e), env))
    return null
  }
}

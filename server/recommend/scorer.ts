import type { Seat, SeatMap } from '../seatmap/seatMap.ts'
import type { Sun } from './sun.ts'

/**
 * 좌석 점수 (Seat Fit Score) = (항목 점수 × 가중치)의 합 ÷ 가중치 합 × 100, 반올림한 정수.
 * 항목은 sunlight · view · quietness · turbulence · quickExit · position 여섯 개이고 항목 점수는 0~1이다.
 * 한 사람 기준이고 일반석만 추천한다. 등받이가 고정된 좌석은 뺀다. 조정할 숫자는 아래 상수에 모아 두었다.
 *
 * 항공사가 알려 주지 않은 정보(null)는 "아니다"로 치지 않는다:
 * 창문 · 날개 위 · 화장실 근처를 모르면 "그렇다"와 "아니다" 점수의 가운데를 주고,
 * 날개 위치를 아예 모르는 배치는 날개가 흔히 있는 자리(WING_GUESS)로 어림해 흔들림을 매긴다.
 * 이런 점수는 "나쁘다"가 아니라 "모른다"라서, 그렇게 매긴 항목은 잘 맞는 점 · 아쉬운 점으로 내세우지 않는다.
 */

/** 취향 1~5 (1은 "전혀 신경 안 씀")와 창가 · 통로 선호. */
export type Preferences = {
  sunlight: number; view: number; quietness: number; turbulence: number; quickExit: number; seatPosition: string
}

/**
 * 좌석 하나의 결과.
 * features: 잘 맞는 항목 — 점수 0.7 이상인 것을 가중치 × 점수가 큰 순서로 최대 4개.
 * tradeoff: 가장 아쉬운 항목 — 점수 0.7 미만인 것 중 가중치 × (1 − 점수)가 가장 큰 하나, 없으면 null.
 * 가중치가 0인 항목(신경 안 쓰는 것)과 모르는 정보로 매긴 항목은 어느 쪽에도 나오지 않는다.
 * unsure: 모르는 정보로 매긴 항목. 점수는 어림값이라 화면이 "보통" 같은 등급 대신 "모름"으로 보여 준다.
 */
export type Scored = {
  rank: number; seat: string; score: number; scores: Record<string, number>
  features: string[]; tradeoff: string | null; unsure: string[]
}

// ── 조정할 숫자 ──
/** 창가 · 통로 선호의 가중치. 나머지 항목의 가중치는 취향 − 1 (0~4). */
export const POSITION_WEIGHT = new Map([
  ['always-aisle', 4], ['prefer-aisle', 2], ['any', 0], ['prefer-window', 2], ['always-window', 4],
])
/** 햇빛이 좌석까지 닿는 정도. 가운데 묶음(side center)은 창에서 멀어 닿지 않는다고 본다. */
export const SUN_REACH = new Map([['window', 1.0], ['middle', 0.6], ['aisle', 0.3]])
export const VIEW_CLEAR = 1.0 // 창문 있는 창가, 날개 밖
export const VIEW_OVER_WING = 0.6 // 창문 있는 창가, 날개 위
export const VIEW_NO_WINDOW = 0.2 // 창문 없는 창가 · 가운데 좌석
export const VIEW_AISLE = 0
export const QUIET_ZONE = new Map([['front', 1.0], ['middle', 0.7], ['rear', 0.4]])
export const QUIET_NEAR_LAVATORY = 0.3 // 화장실 · 갤리 근처면 깎는 점수
export const QUIET_EXIT_SEAT = 0.1 // 비상구 좌석이면 깎는 점수 (좌석 하나 단위)
export const POSITION_MIDDLE = 0.3 // 창가 · 통로를 원하는데 가운데 좌석일 때
export const UNKNOWN = 0.5 // 모름(null)은 "그렇다"일 가능성을 반으로 본다
// 날개 위치를 모르는 배치는 날개 가운데가 앞에서 이만큼(줄 수의 비율)에 있다고 어림한다.
// 날개를 아는 통로 하나짜리 배치 26개가 0.41~0.49다 (모르는 배치 6개도 모두 통로 하나짜리).
// ponytail: 평균 하나로 어림한다 (두세 줄 어긋날 수 있다). 더 정확해야 하면 같은 기종 다른 항공사 배치의 날개 열을 쓴다
export const WING_GUESS = 0.45
export const FEATURE_MIN = 0.7 // 이 점수부터 "잘 맞는 항목"
export const FEATURE_MAX = 4

/** 일반석(등받이 고정 좌석 제외)을 점수 높은 순 → 앞 열 순 → 좌석 글자 순으로. 언제 불러도 같은 순서다. */
export function rank(map: SeatMap, sun: Sun, p: Preferences): Scored[] {
  // 열 번호는 건너뛴다(대한항공 일반석은 28열부터). 그래서 거리는 번호가 아니라 앞에서 몇 번째 줄인지로 잰다
  const rows = [...new Set(map.seats.map(s => s.row))].sort((a, b) => a - b)
  const last = rows.length - 1
  const wing = map.seats.filter(s => s.overWing === true).map(s => rows.indexOf(s.row))
  const wingKnown = wing.length > 0
  const wingCenter = wingKnown ? (Math.min(...wing) + Math.max(...wing)) / 2.0 : last * WING_GUESS
  const farthest = Math.max(wingCenter, last - wingCenter)
  const wanted = p.seatPosition.endsWith('window') ? 'window' : p.seatPosition.endsWith('aisle') ? 'aisle' : null

  // 이 순서가 항목 순서다 (동점일 때 앞 항목 먼저)
  const weights = new Map([
    ['sunlight', p.sunlight - 1],
    ['view', p.view - 1],
    ['quietness', p.quietness - 1],
    ['turbulence', p.turbulence - 1],
    ['quickExit', p.quickExit - 1],
    ['position', POSITION_WEIGHT.get(p.seatPosition) ?? 0],
  ])
  const weightOf = (item: string) => weights.get(item) ?? 0
  const weightSum = [...weights.values()].reduce((sum, weight) => sum + weight, 0)

  const entries: { seat: Seat; scored: Scored }[] = []
  for (const s of map.seats) {
    // 등받이가 고정이라고 확인된 좌석은 추천하지 않는다. 모름(null)은 고정이라고 볼 수 없어 그대로 추천한다
    if (s.cabin !== 'economy' || s.noRecline === true) continue
    const row = rows.indexOf(s.row)
    const sunOnSide = s.side === 'left' ? sun.left : s.side === 'right' ? sun.right : 0

    const scores: Record<string, number> = {
      sunlight: round2(1 - sunOnSide * (SUN_REACH.get(s.position) ?? 0)),
      view: round2(view(s)),
      quietness: round2(Math.max(0, (QUIET_ZONE.get(s.zone) ?? 0)
        - chance(s.nearLavatory) * QUIET_NEAR_LAVATORY - (s.exitRow ? QUIET_EXIT_SEAT : 0))),
      turbulence: round2(farthest === 0 ? 1 : 1 - Math.abs(row - wingCenter) / farthest),
      quickExit: round2(last === 0 ? 1 : 1 - row / last),
      position: wanted === null || s.position === wanted ? 1.0 : s.position === 'middle' ? POSITION_MIDDLE : 0.0,
    }

    // 모르는 정보로 매긴 항목: 총점에는 들어가지만 잘 맞는 점 · 아쉬운 점으로 내세우지 않는다
    const unsure: string[] = []
    if (s.position === 'window' && (s.hasWindow === null || s.overWing === null)) unsure.push('view')
    if (s.nearLavatory === null) unsure.push('quietness')
    if (!wingKnown) unsure.push('turbulence')

    let sum = 0 // 가중치 × 점수(백분의 일 단위). 정수로 더해야 89.5가 89.4999…가 되어 내려가지 않는다
    let tradeoff: string | null = null
    let worst = 0
    const features: string[] = []
    for (const [item, weight] of weights) {
      if (weight === 0) continue
      const score = scores[item]
      sum += weight * Math.round(score * 100)
      if (unsure.includes(item)) continue
      if (score >= FEATURE_MIN) {
        features.push(item)
        continue // 잘 맞는 항목은 아쉬운 항목이 될 수 없다 (같은 항목이 양쪽에 나오면 안 된다)
      }
      const loss = weight * (1 - score)
      if (loss > worst) {
        worst = loss
        tradeoff = item
      }
    }
    features.sort((a, b) => weightOf(b) * scores[b] - weightOf(a) * scores[a])
    const total = weightSum === 0 ? 100 : Math.round(sum / weightSum)
    entries.push({
      seat: s,
      scored: { rank: 0, seat: s.seat, score: total, scores, features: features.slice(0, FEATURE_MAX), tradeoff, unsure },
    })
  }
  entries.sort((a, b) => b.scored.score - a.scored.score
    || a.seat.row - b.seat.row
    || (a.seat.column < b.seat.column ? -1 : a.seat.column > b.seat.column ? 1 : 0))

  return entries.map((entry, i) => ({ ...entry.scored, rank: i + 1 }))
}

function view(s: Seat): number {
  if (s.position === 'aisle') return VIEW_AISLE
  if (s.position === 'middle') return VIEW_NO_WINDOW
  const window = chance(s.hasWindow)
  const wing = chance(s.overWing)
  return window * (wing * VIEW_OVER_WING + (1 - wing) * VIEW_CLEAR) + (1 - window) * VIEW_NO_WINDOW
}

/** true 1 · false 0 · 모름 0.5. */
function chance(known: boolean | null): number {
  return known === null ? UNKNOWN : known ? 1 : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

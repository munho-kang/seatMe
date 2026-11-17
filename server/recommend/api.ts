import { aircraftName } from '../aircraft/names.ts'
import type { Env } from '../config.ts'
import { validDay } from '../flight/flights.ts'
import { fromKst, kst } from '../kst.ts'
import { seatMaps } from '../seatmap/repository.ts'
import { type Forecast, forecast } from '../weather/kma.ts'
import { POSITION_WEIGHT, rank } from './scorer.ts'
import { type Sun, sunOf } from './sun.ts'

const AIRPORT_NAMES = new Map([['GMP', '김포공항'], ['CJU', '제주공항'], ['PUS', '김해공항']])

const FLIGHT = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
const LEVEL = /^[1-5]$/
const TOP = 3
/** 국내선은 길어야 1시간 남짓이다. 이보다 길면(도착이 출발보다 훨씬 이른 값 포함) 잘못 보낸 값으로 본다. (분) */
const MAX_FLIGHT_MIN = 3 * 60

/**
 * 화면이 부르는 창구 — GET /api/recommend. 고른 항공편(시각 · 기종 · 배치도)과 취향으로 일반석 TOP 3를 계산한다.
 * 좌석과 점수는 계산만으로 정한다: 항공편 공공데이터를 다시 부르지 않고, 화면이 /api/flights에서 받은 값을 그대로 실어 보낸다.
 * 기상청 예보는 설명 한 줄(weatherNote)에만 쓴다. 기상청이 답하지 않아도 추천은 그대로 나간다.
 * 화면이 보낸 값이라 형식을 전부 확인한다. 규칙은 api.test.ts 머리 주석이 기준이다.
 */
export async function recommendApi(query: URLSearchParams, env: Env, now: number): Promise<Response> {
  const q = (name: string) => query.get(name) // 같은 이름이 두 번 오면 첫 값
  const invalid = () => Response.json({ error: 'INVALID_QUERY' }, { status: 400 })

  const from = q('from')
  const to = q('to')
  const day = validDay(from, to, q('date'), now)
  const flight = q('flight')
  const dep = q('dep')
  const arr = q('arr')
  const levels = ['sunlight', 'view', 'quietness', 'turbulence', 'quickExit'].map(name => {
    const value = q(name)
    return value !== null && LEVEL.test(value) ? Number(value) : null
  })
  const seatPosition = q('seatPosition')
  if (day === null || from === null || to === null || flight === null || !FLIGHT.test(flight)
    || dep === null || !HH_MM.test(dep) || arr === null || !HH_MM.test(arr)
    || flightMinutes(dep, arr) > MAX_FLIGHT_MIN
    || levels.includes(null) || seatPosition === null || !POSITION_WEIGHT.has(seatPosition))
    return invalid()

  // /api/flights의 seatMapReady와 같은 판단: 편명 앞 두 글자(항공사) + 기종 코드의 배치도 후보
  const candidates = seatMaps.candidatesFor(flight.slice(0, 2), q('aircraftCode'), null).ids
  if (candidates.length === 0) return Response.json({ error: 'SEAT_MAP_NOT_READY' }, { status: 404 })
  const seatMapId = q('seatMap')
  const map = seatMapId !== null && candidates.includes(seatMapId) ? seatMaps.findById(seatMapId) : undefined
  if (seatMapId === null || map === undefined) return invalid()

  const sun = sunOf(from, to, day, dep, arr)
  const [sunlight, view, quietness, turbulence, quickExit] = levels as number[]
  const ranked = rank(map, sun, { sunlight, view, quietness, turbulence, quickExit, seatPosition })
  const departAt = fromKst(day, dep)
  const arriveAt = fromKst(day, arr) + (arr > dep ? 0 : 24 * 3600_000) // 도착이 출발보다 이르면 다음 날 도착
  return Response.json({
    aircraft: aircraftName(q('aircraftCode') ?? ''),
    seatMapId,
    sun,
    seats: ranked.slice(0, TOP),
    weatherNote: await weatherNote(env, from, to, departAt, arriveAt, sun, now),
  })
}

/** 출발 → 도착 (분). 도착이 출발보다 이르거나 같으면 다음 날 도착으로 센다 (sunOf와 같은 규칙). */
function flightMinutes(dep: string, arr: string): number {
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
  const gap = minutes(arr) - minutes(dep)
  return gap > 0 ? gap : gap + 24 * 60
}

/**
 * 날씨 설명 한 줄, 없으면 null. 점수는 바꾸지 않는다: 비행기는 이륙 몇 분 뒤 구름 위로 올라가서 날씨가 햇빛을 가리는 것은 이착륙 몇 분뿐이다.
 * 문구는 임시다 (디자인 확인).
 */
async function weatherNote(
  env: Env, from: string, to: string, departAt: number, arriveAt: number, sun: Sun, now: number,
): Promise<string | null> {
  if (sun.left === 0 && sun.right === 0) return null // 밤 비행은 가릴 햇빛이 없다
  // 두 공항을 동시에 묻는다 (한 번에 1초쯤 걸린다)
  const [departure, arrival] = await Promise.all([forecast(env, from, departAt, now), forecast(env, to, arriveAt, now)])

  const cloudy = [cloud('출발할 때 ', from, departure), cloud('도착할 때 ', to, arrival)]
    .filter(text => text !== null).join(', ')
  const known = departure ?? arrival
  if (known === null || (cloudy === '' && (departure === null || arrival === null))) return null // 한쪽이라도 모르면 "모두 없어요"라고 못 한다
  const announced = kst(known.announced)
  return (cloudy === '' ? '출발 · 도착 공항 모두 흐림 · 비 예보가 없어요' : cloudy + ' 예보라 햇빛 걱정이 적어요')
    + ` (${Number(announced.slice(8, 10))}일 ${Number(announced.slice(11, 13))}시 발표 예보 기준)`
}

/** "출발할 때 김포공항 흐림". 예보가 없거나 흐림 · 비 · 눈이 아니면 null (구름많음은 흐림으로 치지 않는다). */
function cloud(when: string, airport: string, forecast: Forecast | null): string | null {
  if (forecast === null) return null
  const sky = forecast.pty === 0 ? (forecast.sky === 4 ? '흐림' : null)
    : forecast.pty === 2 ? '비 또는 눈'
    : forecast.pty === 3 ? '눈'
    : forecast.pty === 4 ? '소나기'
    : '비'
  return sky === null ? null : when + AIRPORT_NAMES.get(airport) + ' ' + sky
}

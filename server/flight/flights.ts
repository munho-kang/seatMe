import { findByRoute, type KacItem, nearestRecord } from '../aircraft/kac.ts'
import { aircraftName } from '../aircraft/names.ts'
import { type Env, redact } from '../config.ts'
import { fromKst, kst } from '../kst.ts'
import { seatMaps } from '../seatmap/repository.ts'
import { type Flight, searchFlights, UpstreamError } from './molit.ts'

/** 우리 공항 코드 → 국토부 공항 ID (실제 API로 확인한 값). */
export const MOLIT_AIRPORT_ID = new Map([
  ['GMP', 'NAARKSS'], // 김포
  ['CJU', 'NAARKPC'], // 제주
  ['PUS', 'NAARKPK'], // 부산(김해)
])

/**
 * 화면이 부르는 창구 — GET /api/flights?from=GMP&to=CJU&date=2026-11-13.
 * 요청을 먼저 확인해 틀리면 400, 국토부가 답하지 않으면 502, 아니면 {"flights":[...]}.
 */
export async function flightsApi(query: URLSearchParams, env: Env, now: number): Promise<Response> {
  const from = param(query, 'from')
  const to = param(query, 'to')
  const day = validDay(from, to, param(query, 'date'), now)
  if (day === null || from === null || to === null) return Response.json({ error: 'INVALID_QUERY' }, { status: 400 })
  try {
    const flights = notDeparted(
      await searchFlights(env, MOLIT_AIRPORT_ID.get(from) ?? '', MOLIT_AIRPORT_ID.get(to) ?? '', day), day, now)
    // 항공편이 있을 때만 공항공사에 묻고, 편명 + 가장 가까운 출발 시각으로 합친다. 답이 없으면 기종만 빈 채로 나간다.
    const records = flights.length === 0 ? new Map<string, KacItem[]>() : await findByRoute(env, from, to, day)
    return Response.json({
      flights: flights.map(flight => withSeatMaps(flight, nearestRecord(records.get(flight.flightNumber), flight.departureTime))),
    })
  } catch (e) {
    if (!(e instanceof UpstreamError)) throw e
    console.warn(redact('국토부 응답 실패 → 502: ' + e.message, env))
    return Response.json({ error: 'UPSTREAM_UNAVAILABLE' }, { status: 502 })
  }
}

/** 매개변수 값. 없으면 null. 같은 이름이 두 번 오면 쉼표로 이어 붙인다 (Java 서버와 같게 — 그래서 틀린 값이 된다). */
function param(query: URLSearchParams, name: string): string | null {
  const values = query.getAll(name)
  return values.length === 0 ? null : values.join(',')
}

/** 기록이 없으면 항공편 그대로. 있으면 편명 앞 두 글자(항공사) + 기종 + 등록번호로 배치도 후보를 붙인다. */
function withSeatMaps(flight: Flight, record: KacItem | null): Flight {
  if (record === null) return flight
  const code = record.icaoApmCd ?? ''
  const airline = flight.flightNumber.length < 2 ? null : flight.flightNumber.slice(0, 2)
  const candidates = seatMaps.candidatesFor(airline, code, record.aplRegNo)
  return {
    ...flight, aircraft: aircraftName(code), aircraftCode: code,
    seatMapReady: candidates.ids.length > 0, seatMaps: candidates.ids, seatMapConfirmed: candidates.confirmed,
  }
}

/** 오늘 검색이면 이미 떠난 편(출발 시각이 지금이거나 그 전)을 뺀다. 다 빠지면 빈 목록 → 상황 ①. day는 'YYYY-MM-DD', now는 epoch ms. */
export function notDeparted(flights: Flight[], day: string, now: number): Flight[] {
  const nowKst = kst(now)
  if (day !== nowKst.slice(0, 10)) return flights
  const time = nowKst.slice(11) // "14:00:00.000"
  return flights.filter(flight => flight.departureTime + ':00.000' > time)
}

/** from · to · date가 규칙에 맞으면 그 날짜('YYYY-MM-DD'), 아니면 null. /api/recommend도 같은 규칙을 쓴다. */
export function validDay(from: string | null, to: string | null, date: string | null, now: number): string | null {
  if (from === null || to === null || date === null) return null
  if (!MOLIT_AIRPORT_ID.has(from) || !MOLIT_AIRPORT_ID.has(to) || from === to) return null
  if (Number.isNaN(fromKst(date, '00:00'))) return null // YYYY-MM-DD 만 받는다
  // 날짜는 오늘 ~ 1년 뒤. 더 먼 날짜는 국토부에 묻지 않는다
  const today = kst(now).slice(0, 10)
  const monthDay = today.slice(4) === '-02-29' ? '-02-28' : today.slice(4) // 2월 29일의 1년 뒤는 2월 28일
  return date >= today && date <= Number(today.slice(0, 4)) + 1 + monthDay ? date : null
}

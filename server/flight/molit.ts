import { config, encodeKey, type Env, redact } from '../config.ts'
import { fromCompact, kst } from '../kst.ts'

/**
 * 화면에 돌려주는 항공편 한 개 (10칸).
 * 앞 5칸은 국토부 답으로, 뒤 5칸(기종 · 배치도)은 공항공사 답과 좌석 배치도 파일로 채운다.
 */
export type Flight = {
  airline: string // 항공사 이름 · "제주항공"
  flightNumber: string // 편명 · "7C115"
  departureTime: string // 출발 "14:10" (24시간, 한국 시각)
  arrivalTime: string // 도착 "15:20"
  duration: string // "1시간 10분"
  aircraft: string // 화면 이름 "B737-800", 모르면 ""
  aircraftCode: string // 공항공사 코드 "B738", 모르면 ""
  seatMapReady: boolean // 그 항공사 + 기종의 배치도가 하나라도 있으면 true
  seatMaps: string[] // 후보 배치도 id (대표가 맨 앞), 없으면 []
  seatMapConfirmed: boolean // 후보가 정확히 하나로 정해졌으면 true
}

/** 국토부가 제때 올바른 답을 주지 않았다 (시간 초과 · 오류 · 읽을 수 없는 응답). 창구는 이걸 502로 바꾼다. */
export class UpstreamError extends Error {}

// 공공데이터 답은 모양을 믿을 수 없어 칸마다 확인하며 읽는다
// oxlint-disable-next-line typescript/no-explicit-any
type Json = any

/**
 * 국토교통부(TAGO) 국내항공운항정보에 인증키를 붙여 묻고, 답을 화면용 Flight으로 바꾼다.
 * 문서: https://www.data.go.kr/data/15098526/openapi.do
 * 출발·도착은 국토부 공항 ID(NAARKSS 등), date는 'YYYY-MM-DD'. 출발 시각 순으로 돌려준다.
 */
export async function searchFlights(env: Env, depAirportId: string, arrAirportId: string, date: string): Promise<Flight[]> {
  if (!env.MOLIT_SERVICE_KEY?.trim())
    console.warn('국토부 인증키가 비어 있어요. .dev.vars 에 MOLIT_SERVICE_KEY=발급받은키 를 넣어 주세요. 키가 없으면 /api/flights 는 늘 502예요.')
  // ponytail: 한 노선 하루 운항은 500편을 넘지 않는다고 보고 한 장(pageNo=1)에 다 받는다. totalCount가 더 크면 pageNo를 넘기도록 바꾼다.
  const url = config.molitBaseUrl + '/GetFlightOpratInfoList'
    + '?serviceKey=' + encodeKey(env.MOLIT_SERVICE_KEY)
    + '&depAirportId=' + depAirportId
    + '&arrAirportId=' + arrAirportId
    + '&depPlandTime=' + date.replaceAll('-', '')
    + '&numOfRows=500&pageNo=1&_type=json'

  let status: number
  let body: string
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(config.molitTimeoutMs) })
    status = response.status
    body = await response.text()
  } catch (e) { // 시간 초과도 여기로 온다
    throw new UpstreamError('국토부가 답하지 않았어요: ' + e)
  }
  if (status !== 200) throw new UpstreamError(`국토부 HTTP ${status} ${head(body, env)}`)
  try {
    return parse(JSON.parse(body))
  } catch (e) {
    if (e instanceof UpstreamError) throw e
    throw new UpstreamError('국토부 응답을 읽을 수 없어요: ' + head(body, env)) // JSON이 아니거나 칸 모양이 다를 때
  }
}

function parse(root: Json): Flight[] {
  const header = root?.response?.header
  if (String(header?.resultCode ?? '') !== '00')
    throw new UpstreamError(`국토부 오류 ${header?.resultCode ?? ''} ${header?.resultMsg ?? ''}`)
  // 국토부는 결과가 0개면 items를 빈 글자 ""로, 1개면 item을 목록이 아닌 객체 하나로 준다
  const item = root.response.body?.items?.item
  const list: Json[] = Array.isArray(item) ? item : item !== null && typeof item === 'object' ? [item] : []
  return list.map(toFlight).sort((a, b) => (a.departureTime < b.departureTime ? -1 : a.departureTime > b.departureTime ? 1 : 0))
}

function toFlight(node: Json): Flight {
  // 국토부는 시각을 숫자(202611131410)로 준다
  const dep = fromCompact(String(node?.depPlandTime ?? ''))
  const arr = fromCompact(String(node?.arrPlandTime ?? ''))
  if (Number.isNaN(dep) || Number.isNaN(arr)) throw new Error('출발 · 도착 시각을 읽을 수 없다')
  return {
    airline: String(node.airlineNm ?? '').replaceAll(' ', ''), // 국토부는 "제주 항공"처럼 띄어 보낸다. 화면에는 붙여서 나간다
    flightNumber: String(node.vihicleId ?? ''), // 국토부 칸 이름이 원래 이렇게(vehicle 오타) 적혀 있다
    departureTime: kst(dep).slice(11, 16), // "14:10"
    arrivalTime: kst(arr).slice(11, 16),
    duration: formatDuration((arr - dep) / 60_000),
    // 기종 · 배치도 5칸은 창구에서 채운다 — 비어 있으면 상황 ④ "추천 준비 중"
    aircraft: '', aircraftCode: '', seatMapReady: false, seatMaps: [], seatMapConfirmed: false,
  }
}

/** 분 → "1시간 10분" · "1시간" · "45분". */
export function formatDuration(minutes: number): string {
  const h = Math.trunc(minutes / 60)
  const m = minutes % 60
  if (h === 0) return m + '분'
  if (m === 0) return h + '시간'
  return `${h}시간 ${m}분`
}

/** 로그에 남길 답의 앞머리. 인증키를 먼저 가리고 자른다 (자른 뒤에 가리면 잘린 키 조각이 남는다). */
function head(body: string, env: Env): string {
  return redact(body, env).trim().slice(0, 200)
}

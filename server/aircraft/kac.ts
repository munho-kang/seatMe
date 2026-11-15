import { config, encodeKey, type Env, redact } from '../config.ts'

/**
 * 한국공항공사 기종 API의 항공편 한 건. 우리가 쓸 칸만 골라 담았어요.
 * JSON 구조: response → header / body → items → item[]
 * 오류일 때는 HTTP 200이어도 OpenAPI_ServiceResponse → cmmMsgHeader 모양으로 온다 (2026-11-09 실제 확인)
 */
export type KacItem = {
  airFln: string | null // 편명 (예: RS6347)
  std: string | null // 예정 시간 (예: 202611110600)
  io: string | null // O = 출발, I = 도착
  airport: string | null // 기준공항 (예: GMP)
  city: string | null // 상대공항 (예: CJU)
  icaoApmCd: string | null // 기종 코드 (예: A321) ← 우리가 필요한 값
  aplRegNo: string | null // 등록번호 (예: HL8099). 당일 편에만 채워짐
}

// 공공데이터 답은 모양을 믿을 수 없어 칸마다 확인하며 읽는다
// oxlint-disable-next-line typescript/no-explicit-any
type Json = any

/**
 * 한 공항의 하루치 기록을 끝까지 받아요. 편명마다 따로 묻지 않고 한꺼번에 받으려고 만들었어요.
 * airport는 공항 코드(예: GMP), date는 'YYYY-MM-DD'. 중간에 오류가 나면 거기까지 받은 것만 돌려줘요 (던지지 않아요).
 */
// ponytail: 쪽을 하나씩 차례로 받는다. 응답이 느리면 대기 시간이 쪽 수만큼 늘어나니, 조회가 느려지면 동시에 받거나 결과를 저장해 두도록 바꾼다.
export async function searchAirportDay(env: Env, airport: string, date: string): Promise<KacItem[]> {
  const day = date.replaceAll('-', '')
  const all: KacItem[] = []
  try {
    for (let page = 1; ; page++) {
      // 공항공사가 답을 안 해도 하염없이 기다리지 않도록 제한 시간을 둬요
      const response = await fetch(
        `${config.kacBaseUrl}?serviceKey=${encodeKey(env.KAC_API_KEY)}&type=json&numOfRows=100&pageNo=${page}`
          + `&schAirCode=${airport}&schStTime=${day}0000&schEdTime=${day}2359`,
        { signal: AbortSignal.timeout(config.kacTimeoutMs) })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const result: Json = await response.json()
      const error = errorOf(result)
      if (error !== null) {
        console.warn(redact('공항공사 기종 API 오류 응답 → 기종만 비운다: ' + error, env))
        return all
      }

      const items = itemsOf(result)
      all.push(...items)
      // 전체 개수가 없거나 숫자가 아니면 0으로 보고 여기서 멈춘다 (Java 서버와 같다)
      if (items.length === 0 || all.length >= (Number(result.response.body.totalCount) || 0)) return all
    }
  } catch (e) {
    // JSON 오류 문구에는 답의 앞머리가 들어 있어 그대로 남기지 않는다 (인증키 조각이 섞일 수 있다)
    const why = e instanceof SyntaxError ? 'JSON이 아닌 응답' : e instanceof Error ? e.message : e
    console.warn(redact('공항공사 기종 API 오류 → 기종만 비운다: ' + why, env))
    return all
  }
}

/** 정상 답(resultCode "00")이면 null, 아니면 오류 이름과 코드. 주소·인증키는 넣지 않는다. */
function errorOf(result: Json): string | null {
  if (result == null) return '빈 응답'
  const serviceError = result.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (serviceError != null) return `${serviceError.errMsg} (코드 ${serviceError.returnReasonCode})`
  const header = result.response?.header
  if (header == null) return '모르는 응답 모양'
  return String(header.resultCode) === '00' ? null : `${header.resultMsg} (코드 ${header.resultCode})`
}

/** 응답이 비어 있으면 빈 목록. 칸은 글자로 바꿔 담는다 (공항공사가 숫자로 줄 때가 있다). */
function itemsOf(result: Json): KacItem[] {
  const item = result?.response?.body?.items?.item
  if (!Array.isArray(item)) return []
  const text = (value: unknown) => (value == null ? null : String(value))
  return item.map((raw: Json) => ({
    airFln: text(raw?.airFln), std: text(raw?.std), io: text(raw?.io), airport: text(raw?.airport),
    city: text(raw?.city), icaoApmCd: text(raw?.icaoApmCd), aplRegNo: text(raw?.aplRegNo),
  }))
}

/**
 * 그날 그 노선의 출발 기록을 한꺼번에 가져와요.
 * 돌려주는 값: 편명 → 그 편명의 출발 기록들 (하루 두 번 뜨는 편명은 기록이 둘). 공항공사가 답이 없으면 빈 Map
 */
export async function findByRoute(env: Env, from: string, to: string, date: string): Promise<Map<string, KacItem[]>> {
  const byFlight = new Map<string, KacItem[]>()
  for (const item of await searchAirportDay(env, from, date)) {
    if (item.io !== 'O' || item.airport !== from || item.city !== to) continue
    if (item.airFln == null || item.icaoApmCd == null || item.icaoApmCd.trim() === '') continue
    if (item.std == null || !/^\d{12}$/.test(item.std)) continue
    const records = byFlight.get(item.airFln)
    if (records) records.push(item)
    else byFlight.set(item.airFln, [item])
  }
  return byFlight
}

/**
 * 같은 편명의 기록 중 출발 시각이 가장 가까운 것의 기록 자체.
 * 두 기관의 시각은 1시간쯤 어긋날 수 있어서, 딱 맞는 시각 대신 가장 가까운 시각으로 짝지어요.
 * records는 findByRoute가 준 그 편명의 기록들 (없으면 짝 없음), departureTime은 국토부 출발 시각 "14:10".
 */
// ponytail: 기록이 하나뿐이면 시각 차이와 상관없이 그 기록을 써요. 엉뚱하게 붙는 일이 생기면 "2시간 이내만" 같은 한도를 추가.
export function nearestRecord(records: KacItem[] | undefined, departureTime: string): KacItem | null {
  if (records == null) return null
  const dep = Number(departureTime.slice(0, 2)) * 60 + Number(departureTime.slice(3, 5))
  let nearest: KacItem | null = null
  let nearestGap = Infinity
  for (const item of records) {
    const std = item.std ?? ''
    const gap = Math.abs(Number(std.slice(8, 10)) * 60 + Number(std.slice(10, 12)) - dep) // 하루 안의 시각 차이 (분)
    if (gap < nearestGap) {
      nearest = item
      nearestGap = gap
    }
  }
  return nearest
}

// 서버(GET /api/flights)가 받는 공항은 GMP·CJU·PUS뿐이라 이 3개만 고를 수 있게 한다
export const AIRPORTS = [
  { code: 'GMP', name: '김포', fullName: '김포국제공항' },
  { code: 'CJU', name: '제주', fullName: '제주국제공항' },
  { code: 'PUS', name: '부산', fullName: '김해국제공항' },
] as const

export type AirportCode = (typeof AIRPORTS)[number]['code']

export const AIRPORT_NAMES = Object.fromEntries(AIRPORTS.map(({ code, name }) => [code, name])) as Record<AirportCode, string>

export type Passengers = { adult: number; child: number; infant: number }

export function formatPassengers({ adult, child, infant }: Passengers) {
  const parts = [`성인 ${adult}명`]
  if (child > 0) parts.push(`소아 ${child}명`)
  if (infant > 0) parts.push(`유아 ${infant}명`)
  return parts.join(', ')
}

export type Flight = {
  airline: string
  flightNumber: string
  departureTime: string
  arrivalTime: string
  aircraft: string
  aircraftCode: string
  seatMapReady: boolean
  duration: string
  // 좌석 배치도 후보 id. 대표 배치가 맨 앞이고, 없으면 []
  seatMaps: string[]
  // 후보가 하나로 정해졌는가. 후보 개수로 판단하지 않고 이 값을 그대로 쓴다 (후보가 하나여도 false일 수 있다)
  seatMapConfirmed: boolean
}

function isAirportCode(value: string | null): value is AirportCode {
  return value !== null && value in AIRPORT_NAMES
}

// URL 쿼리의 경로를 읽는다. 값이 없거나 잘못되면 Figma 기본 경로(김포 → 제주)를 쓴다
export function getRouteTitle(searchParams: URLSearchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  return `${AIRPORT_NAMES[isAirportCode(from) ? from : 'GMP']} → ${AIRPORT_NAMES[isAirportCode(to) ? to : 'CJU']}`
}

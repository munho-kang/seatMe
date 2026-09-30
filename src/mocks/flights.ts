// 실제 API 연결 전까지 쓰는 mock 데이터. 실제 운항 정보가 아니다.

export type AirportCode = 'GMP' | 'CJU' | 'PUS'

export const AIRPORT_NAMES: Record<AirportCode, string> = {
  GMP: '김포',
  CJU: '제주',
  PUS: '부산',
}

export type Flight = {
  airline: string
  flightNumber: string
  departureTime: string
  arrivalTime: string
  aircraft: string
  duration: string
}

export const FLIGHTS: Flight[] = [
  { airline: '제주항공', flightNumber: '7C115', departureTime: '14:10', arrivalTime: '15:20', aircraft: 'B737-8', duration: '1시간 10분' },
  { airline: '진에어', flightNumber: 'LJ569', departureTime: '14:35', arrivalTime: '15:45', aircraft: 'B737-8', duration: '1시간 10분' },
  { airline: '티웨이', flightNumber: 'TW731', departureTime: '15:05', arrivalTime: '16:15', aircraft: 'B737-8', duration: '1시간 10분' },
]

function isAirportCode(value: string | null): value is AirportCode {
  return value !== null && value in AIRPORT_NAMES
}

// URL 쿼리의 경로를 읽는다. 값이 없거나 잘못되면 Figma 기본 경로(김포 → 제주)를 쓴다
export function getRouteTitle(searchParams: URLSearchParams) {
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  return `${AIRPORT_NAMES[isAirportCode(from) ? from : 'GMP']} → ${AIRPORT_NAMES[isAirportCode(to) ? to : 'CJU']}`
}

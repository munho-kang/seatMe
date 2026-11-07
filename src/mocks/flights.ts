// 실제 API 연결 전까지 쓰는 mock 데이터. 실제 운항 정보가 아니다.

export const AIRPORTS = [
  { code: 'GMP', name: '김포', fullName: '김포국제공항' },
  { code: 'CJU', name: '제주', fullName: '제주국제공항' },
  { code: 'PUS', name: '부산', fullName: '김해국제공항' },
  { code: 'ICN', name: '인천', fullName: '인천국제공항' },
  { code: 'TAE', name: '대구', fullName: '대구국제공항' },
  { code: 'CJJ', name: '청주', fullName: '청주국제공항' },
  { code: 'KWJ', name: '광주', fullName: '광주공항' },
  { code: 'RSU', name: '여수', fullName: '여수공항' },
  { code: 'USN', name: '울산', fullName: '울산공항' },
  { code: 'YNY', name: '양양', fullName: '양양국제공항' },
  { code: 'KPO', name: '포항경주', fullName: '포항경주공항' },
  { code: 'HIN', name: '사천', fullName: '사천공항' },
  { code: 'KUV', name: '군산', fullName: '군산공항' },
  { code: 'WJU', name: '원주', fullName: '원주공항' },
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

import { fromKst } from '../kst.ts'

/**
 * 비행 중 왼쪽 · 오른쪽 창으로 드는 햇빛 세기 (각 0~1). 공항 좌표 · 시각 · 태양 위치만으로 계산한다 (FlightSide 방식).
 * 세 지점(이륙 · 중간 · 도착)에서 세기 = cos(태양 고도) × |sin(태양 방위 − 비행 방위)|를 구해 평균 낸다.
 * 해가 낮을수록, 옆에서 비칠수록 강하다. 바꿔 볼 숫자는 아래 상수 두 개다.
 */
export type Sun = { left: number; right: number }

/** 공항 좌표 {위도, 경도}. /api/flights가 받는 공항과 같다. */
export const AIRPORTS = new Map<string, [number, number]>([
  ['GMP', [37.558, 126.791]], // 김포
  ['CJU', [33.511, 126.493]], // 제주
  ['PUS', [35.180, 128.938]], // 김해
])

/** 해가 이 고도(도)보다 낮으면 밤으로 본다. 순항 고도에서는 해가 3°쯤 늦게 지니, 해 질 무렵 편이 이상하면 -3으로. */
export const NIGHT_ELEVATION = 0

/** 예정 출발 시각부터 실제로 떠오를 때까지 (분). */
export const TAKEOFF_DELAY_MIN = 15

const { asin, atan2, cos, sin, tan } = Math
// Java 서버(Math.toRadians · toDegrees)와 똑같은 숫자를 곱한다 — 옮긴 뒤에도 같은 값이 나오게
const toRadians = (degrees: number) => degrees * 0.017453292519943295
const toDegrees = (radians: number) => radians * 57.29577951308232

/** date는 'YYYY-MM-DD', dep · arr는 한국 시각 'HH:mm'. 도착이 출발보다 이르면 다음 날 도착으로 본다. */
export function sunOf(from: string, to: string, date: string, dep: string, arr: string): Sun {
  const a = AIRPORTS.get(from)
  const b = AIRPORTS.get(to)
  if (!a || !b) throw new Error(`모르는 공항: ${from} ${to}`)
  const departure = fromKst(date, dep) / 1000 // 여기부터는 초 단위 (epoch seconds)
  let arrival = fromKst(date, arr) / 1000
  if (!(arrival > departure)) arrival += 86400
  const heading = bearing(a[0], a[1], b[0], b[1])

  // ponytail: 중간 지점은 위도 · 경도의 단순 평균, 방위는 출발 때 값 하나. 국내선 거리(500km 이하)에서는 차이가 없다.
  // 먼 노선을 넣게 되면 대권 경로의 중간점과 지점별 방위로 바꾼다.
  const times = [departure + TAKEOFF_DELAY_MIN * 60, departure + (arrival - departure) / 2, arrival]
  const places = [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b]

  let left = 0
  let right = 0
  for (let i = 0; i < times.length; i++) {
    const [elevation, azimuth] = position(times[i], places[i][0], places[i][1])
    if (elevation < NIGHT_ELEVATION) continue
    const relative = (((azimuth - heading) % 360) + 360) % 360 // 0~180은 오른쪽
    const strength = cos(toRadians(elevation)) * Math.abs(sin(toRadians(relative)))
    if (relative < 180) right += strength
    else left += strength
  }
  return { left: round2(left / times.length), right: round2(right / times.length) }
}

/** 출발지에서 도착지를 보는 방향 (대권 방위각, 북 0° · 동 90°). */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = toRadians(lat1)
  const p2 = toRadians(lat2)
  const dl = toRadians(lon2 - lon1)
  return (toDegrees(atan2(sin(dl) * cos(p2), cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl))) + 360) % 360
}

/** 그 시각(epoch 초) · 그 자리에서 본 태양의 [고도, 방위] (도). NOAA 태양 위치 공식이고 대기 굴절 보정은 뺐다. */
export function position(epochSeconds: number, latitude: number, longitude: number): [number, number] {
  const t = (epochSeconds / 86400.0 + 2440587.5 - 2451545.0) / 36525.0 // 2000년 1월 1일 정오부터 지난 세기
  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const anomaly = toRadians(357.52911 + t * (35999.05029 - 0.0001537 * t))
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const center = sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + sin(2 * anomaly) * (0.019993 - 0.000101 * t)
    + sin(3 * anomaly) * 0.000289
  const omega = toRadians(125.04 - 1934.136 * t)
  const apparentLong = toRadians(meanLong + center - 0.00569 - 0.00478 * sin(omega))
  const obliquity = toRadians(
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * cos(omega))
  const declination = asin(sin(obliquity) * sin(apparentLong))

  // 균시차(분): 시계의 정오와 해가 정남에 오는 때의 차이
  const y = tan(obliquity / 2) * tan(obliquity / 2)
  const l0 = toRadians(meanLong)
  const equationOfTime = 4 * toDegrees(y * sin(2 * l0) - 2 * eccentricity * sin(anomaly)
    + 4 * eccentricity * y * sin(anomaly) * cos(2 * l0)
    - 0.5 * y * y * sin(4 * l0)
    - 1.25 * eccentricity * eccentricity * sin(2 * anomaly))
  const utcMinutes = (epochSeconds % 86400) / 60.0
  const solarMinutes = (((utcMinutes + equationOfTime + 4 * longitude) % 1440) + 1440) % 1440
  const hourAngle = toRadians(solarMinutes / 4 - 180)

  const lat = toRadians(latitude)
  const elevation = asin(sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle))
  const azimuth = atan2(sin(hourAngle), cos(hourAngle) * sin(lat) - tan(declination) * cos(lat))
  return [toDegrees(elevation), (toDegrees(azimuth) + 180) % 360]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

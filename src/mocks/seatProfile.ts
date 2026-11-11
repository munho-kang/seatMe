// 프로필 API 전까지 쓰는 mock Seat Profile. 새로고침하면 Figma 기본값으로 돌아간다.
// 칸 이름과 값은 서버 GET /api/recommend가 받는 취향 그대로다 (src/recommend.ts가 통째로 실어 보낸다)

export type SeatPosition = 'always-aisle' | 'prefer-aisle' | 'any' | 'prefer-window' | 'always-window'

export const SEAT_POSITION_OPTIONS: { value: SeatPosition; label: string }[] = [
  { value: 'always-aisle', label: '항상 통로석에 앉아요' },
  { value: 'prefer-aisle', label: '통로석 쪽이 더 좋아요' },
  { value: 'any', label: '상관없어요' },
  { value: 'prefer-window', label: '창가석 쪽이 더 좋아요' },
  { value: 'always-window', label: '항상 창가석에 앉아요' },
]

// 숫자는 1(전혀 신경 안 씀) ~ 5(매우 중요)
export type SeatProfile = {
  seatPosition: SeatPosition
  sunlight: number
  quietness: number
  turbulence: number
  quickExit: number
  view: number
}

let seatProfile: SeatProfile = {
  seatPosition: 'prefer-window',
  sunlight: 5,
  quietness: 4,
  turbulence: 4,
  quickExit: 2,
  // Figma 기본값에 전망이 없어 가운데 값으로 둔다 (임시)
  view: 3,
}

export function getSeatProfile() {
  return seatProfile
}

export function saveSeatProfile(profile: SeatProfile) {
  seatProfile = profile
}

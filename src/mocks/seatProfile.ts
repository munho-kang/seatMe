// 프로필 API 전까지 쓰는 mock Seat Profile. 새로고침하면 Figma 기본값으로 돌아간다.

export type SeatProfile = {
  seatPosition: string
  sunlight: number
  quietness: number
  turbulence: number
  quickExit: number
}

let seatProfile: SeatProfile = {
  seatPosition: '창가석 쪽이 더 좋아요',
  sunlight: 5,
  quietness: 4,
  turbulence: 4,
  quickExit: 2,
}

export function getSeatProfile() {
  return seatProfile
}

export function saveSeatProfile(profile: SeatProfile) {
  seatProfile = profile
}

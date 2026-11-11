// Seat Profile. 로그인 없이 이 기기(브라우저 localStorage)에만 저장한다. 저장한 적이 없으면 Figma 기본값이다.
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

const DEFAULT_PROFILE: SeatProfile = {
  seatPosition: 'prefer-window',
  sunlight: 5,
  quietness: 4,
  turbulence: 4,
  quickExit: 2,
  // Figma 기본값에 전망이 없어 가운데 값으로 둔다 (임시)
  view: 3,
}

const STORAGE_KEY = 'seatme.seatProfile'

// 저장해 둔 글자를 Seat Profile로 바꾼다. 없거나 망가진 칸은 기본값으로 채운다
// (틀린 값이 그대로 나가면 서버가 추천을 400으로 거절한다)
export function parseSeatProfile(text: string | null): SeatProfile {
  let saved: Partial<Record<keyof SeatProfile, unknown>> = {}
  try {
    saved = JSON.parse(text ?? '') ?? {}
  } catch {
    // 저장한 적이 없거나 JSON이 아니다
  }
  const level = (key: Exclude<keyof SeatProfile, 'seatPosition'>) => {
    const value = saved[key]
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5 ? value : DEFAULT_PROFILE[key]
  }
  return {
    seatPosition: SEAT_POSITION_OPTIONS.find((option) => option.value === saved.seatPosition)?.value ?? DEFAULT_PROFILE.seatPosition,
    sunlight: level('sunlight'),
    quietness: level('quietness'),
    turbulence: level('turbulence'),
    quickExit: level('quickExit'),
    view: level('view'),
  }
}

// localStorage는 막혀 있을 수 있다 (사생활 보호 모드 등). 그때는 예전처럼 화면 메모리로만 동작한다
function load() {
  try {
    return parseSeatProfile(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_PROFILE
  }
}

let seatProfile: SeatProfile | undefined

export function getSeatProfile() {
  return (seatProfile ??= load())
}

export function saveSeatProfile(profile: SeatProfile) {
  seatProfile = profile
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // 저장이 막혀 있으면 새로고침 전까지만 유지된다
  }
}

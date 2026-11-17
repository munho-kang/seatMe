// Seat Profile. 네이버 · 이메일로 로그인했으면 계정(서버 /api/profile)에, 아니면 이 기기(브라우저 localStorage)에 저장한다.
// 저장한 적이 없으면 Figma 기본값이다. 로그인 여부는 화면을 그리기 전에 syncSeatProfile()이 한 번 확인한다 (main.tsx).
// 칸 이름과 값은 서버 GET /api/recommend가 받는 취향 그대로다 (src/recommend.ts가 통째로 실어 보낸다)

export type SeatPosition = 'always-aisle' | 'prefer-aisle' | 'any' | 'prefer-window' | 'always-window'

export const SEAT_POSITION_OPTIONS: { value: SeatPosition; label: string }[] = [
  { value: 'always-aisle', label: '항상 통로석에 앉아요' },
  { value: 'prefer-aisle', label: '통로석 쪽이 더 좋아요' },
  { value: 'any', label: '상관없어요' },
  { value: 'prefer-window', label: '창가석 쪽이 더 좋아요' },
  { value: 'always-window', label: '항상 창가석에 앉아요' },
]

// 취향 요약에 쓰는 짧은 이름. 문구는 임시다 (디자인 확인)
export const SEAT_POSITION_SHORT: Record<SeatPosition, string> = {
  'always-aisle': '항상 통로',
  'prefer-aisle': '통로 선호',
  any: '자리 상관없음',
  'prefer-window': '창가 선호',
  'always-window': '항상 창가',
}

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
let loggedIn = false
let accountSaved = false
let nickname: string | null = null

export function getSeatProfile() {
  return (seatProfile ??= load())
}

export function isLoggedIn() {
  return loggedIn
}

// 이메일 계정의 닉네임. 네이버 계정이거나 로그인 안 했으면 null (마이 화면)
export function accountNickname() {
  return nickname
}

// 계정에 저장한 취향이 있는가 (로그인 직후 온보딩을 건너뛸지 정한다)
export function hasAccountProfile() {
  return accountSaved
}

function deviceProfile() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// 화면을 그리기 전에 부른다. 로그인했으면 계정 취향을 쓰고, 계정에 아직 없으면 이 기기 취향을 계정으로 옮긴다.
// 서버가 답하지 않으면 로그인 안 한 것으로 보고 기기 취향을 쓴다 (추천은 로그인 없이도 돌아간다)
export async function syncSeatProfile() {
  try {
    const response = await fetch('/api/profile', { signal: AbortSignal.timeout(3000) })
    if (!response.ok) return
    loggedIn = true
    const body = await response.json()
    const { profile } = body
    nickname = typeof body.nickname === 'string' ? body.nickname : null
    const device = deviceProfile()
    if (profile !== null) {
      seatProfile = parseSeatProfile(JSON.stringify(profile))
      accountSaved = true
    } else if (device !== null && (await putProfile(parseSeatProfile(device)))) {
      seatProfile = parseSeatProfile(device)
      accountSaved = true
      // 계정으로 옮겼으니 기기에서는 지운다 (로그아웃하면 계정 취향이 화면에서 사라지게)
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // 서버에 닿지 않는다
  }
}

// 로그아웃 뒤에는 이 기기 취향(없으면 기본값)으로 돌아간다
export function forgetAccountProfile() {
  loggedIn = false
  accountSaved = false
  nickname = null
  seatProfile = undefined
}

async function putProfile(profile: SeatProfile) {
  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    return response.ok
  } catch {
    return false
  }
}

// 화면에 보여 주는 취향 요약 한 줄 (홈 · 항공편 검색 · 여행 설정). 예: "창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4"
export function describeSeatProfile({ seatPosition, sunlight, quietness, turbulence } = getSeatProfile()) {
  return `${SEAT_POSITION_SHORT[seatPosition]} · 햇빛 ${sunlight} · 조용함 ${quietness} · 흔들림 ${turbulence}`
}

export function saveSeatProfile(profile: SeatProfile) {
  seatProfile = profile
  if (loggedIn) {
    accountSaved = true
    // ponytail: 계정 저장이 실패하면 이 화면에서만 유지되고 다음 접속 때 계정 값으로 돌아간다. 실패가 잦으면 안내 문구 추가
    void putProfile(profile).then((ok) => ok || console.error('계정에 Seat Profile을 저장하지 못했어요'))
    return
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // 저장이 막혀 있으면 새로고침 전까지만 유지된다
  }
}

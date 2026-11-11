// 서버 GET /api/seatmaps/{id} 응답. 규칙은 서버 SeatMapApiTest 머리 주석이 기준이다

// null은 "항공사가 알려 주지 않아 모름"이다. false("아니다")처럼 다루면 안 된다
export type Unknowable = boolean | null

export type Seat = {
  seat: string
  row: number
  column: string
  cabin: 'first' | 'business' | 'premium' | 'economy'
  side: 'left' | 'right' | 'center'
  position: 'window' | 'middle' | 'aisle'
  hasWindow: Unknowable
  overWing: Unknowable
  exitRow: boolean
  zone: 'front' | 'middle' | 'rear'
  nearLavatory: Unknowable
  noRecline: Unknowable
  extraLegroom: boolean
}

export type SeatMap = {
  id: string
  aircraft: string
  name: string
  seatCount: number
  // seats의 띄어쓴 곳이 통로다 ("AB CDEF GH"는 통로 둘). 열 번호는 건너뛸 수 있다
  cabins: { class: Seat['cabin']; fromRow: number; toRow: number; seats: string }[]
  seats: Seat[]
  // afterRow는 "이 열 바로 뒤", 0은 맨 앞
  facilities: { type: 'lavatory' | 'galley' | 'exit'; afterRow: number; side: 'left' | 'right' | 'center' | 'both' }[]
}

export const CABIN_NAMES = { first: '일등석', business: '비즈니스석', premium: '프리미엄 이코노미', economy: '일반석' }

const POSITION_NAMES = { window: '창가', middle: '가운데', aisle: '통로' }

// 좌석 하나를 "아는 사실"과 "모르는 정보"로 나눈다. 모름(null)이 "아니다"로 읽히지 않게 따로 모은다
export function describeSeat(seat: Seat) {
  const facts = [CABIN_NAMES[seat.cabin], POSITION_NAMES[seat.position]]
  const unknowns: string[] = []
  // 창문은 창가 좌석에서만 따진다 (창가가 아니면 서버가 false를 준다)
  if (seat.position === 'window') {
    if (seat.hasWindow === null) unknowns.push('창문 유무')
    else facts.push(seat.hasWindow ? '창문 있음' : '창문 없음')
  }
  const features: [Unknowable, string, string][] = [
    [seat.overWing, '날개 위', '날개 위 여부'],
    [seat.noRecline, '등받이 고정', '등받이 고정 여부'],
    [seat.nearLavatory, '화장실·갤리 근처', '화장실·갤리 근처 여부'],
  ]
  for (const [value, fact, unknown] of features) {
    if (value === null) unknowns.push(unknown)
    else if (value) facts.push(fact)
  }
  if (seat.exitRow) facts.push('비상구 좌석')
  if (seat.extraLegroom) facts.push('다리 공간 넓음')
  return { facts, unknowns }
}

// 좌석맵 아래 날개 안내. 날개 위치를 모르는 배치는 "날개 없음"이 아니라 모른다고 적는다
export function getWingCaption(seats: Seat[]) {
  const rows = seats.filter((seat) => seat.overWing).map((seat) => seat.row)
  if (rows.length) return `날개 영역  ${Math.min(...rows)}–${Math.max(...rows)}열`
  return seats.some((seat) => seat.overWing === null) ? '날개 위치는 항공사가 알려 주지 않았어요' : null
}

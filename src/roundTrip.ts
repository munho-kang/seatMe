// 왕복 흐름: 가는 편 목록 → 오는 편 목록 → 여행 설정 → 분석 → 가는 편 좌석 → 오는 편 좌석 → 예매.
// 주소의 편 칸(LEG_KEYS)은 항상 "지금 보는 편"의 값이고, 다른 편의 값은 other 한 칸에 접어 둔다.
// 그래서 화면들은 지금 보는 편만 읽으면 되고(편도와 같다), 편을 바꿀 때만 swapLeg로 두 편을 맞바꾼다.
// returnDate가 있으면 왕복이고, leg=return이면 지금 보는 편이 오는 편이다
const LEG_KEYS = ['from', 'to', 'date', 'flight', 'airline', 'dep', 'arr', 'aircraft', 'aircraftCode', 'seatMap', 'seatMaps', 'seatMapConfirmed', 'seat']

// 지금 보는 편과 다른 편을 맞바꾼 주소 값. 오는 편을 처음 열 때(other 없음)는 노선을 뒤집고 돌아오는 날을 넣는다
export function swapLeg(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams)
  const current = new URLSearchParams()
  for (const key of LEG_KEYS) {
    const value = searchParams.get(key)
    if (value) current.set(key, value)
    next.delete(key)
  }
  const other = searchParams.get('other')
  if (other === null) {
    next.set('from', searchParams.get('to') ?? '')
    next.set('to', searchParams.get('from') ?? '')
    next.set('date', searchParams.get('returnDate') ?? '')
  } else {
    const otherLeg = new URLSearchParams(other)
    for (const key of LEG_KEYS) {
      const value = otherLeg.get(key)
      if (value) next.set(key, value)
    }
  }
  next.set('other', current.toString())
  if (searchParams.get('leg') === 'return') next.delete('leg')
  else next.set('leg', 'return')
  return next
}

// 오는 편을 건너뛴다: 가는 편으로 돌아가 편도처럼 이어 간다 (오는 편 목록에서 부른다)
export function skipReturn(searchParams: URLSearchParams) {
  const next = swapLeg(searchParams)
  next.delete('other')
  next.delete('returnDate')
  return next
}

// 다른 편까지 정해진 왕복이면 그 편을 "지금 보는 편"으로 바꾼 주소 값, 아니면 null
export function otherLeg(searchParams: URLSearchParams) {
  return new URLSearchParams(searchParams.get('other') ?? '').has('flight') ? swapLeg(searchParams) : null
}

// 화면에 적는 편 이름. 편도면 null. 문구는 임시다 (디자인 확인)
export function legLabel(searchParams: URLSearchParams) {
  return searchParams.get('leg') === 'return' ? '오는 편' : searchParams.get('returnDate') ? '가는 편' : null
}

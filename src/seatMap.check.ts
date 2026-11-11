// 좌석 정보 문구 확인. `npm test`로 돌린다. 틀리면 오류를 내고 멈춘다
import { describeSeat, getWingCaption, type Seat } from './seatMap.ts'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`기대한 값 ${JSON.stringify(expected)} / 실제 값 ${JSON.stringify(actual)}`)
  }
}

// 서버 KE-BCS3-140의 28A (창문 유무를 항공사가 알려 주지 않은 창가 좌석)
const seat: Seat = {
  seat: '28A', row: 28, column: 'A', cabin: 'economy', side: 'left', position: 'window',
  hasWindow: null, overWing: false, exitRow: false, zone: 'front',
  nearLavatory: true, noRecline: false, extraLegroom: false,
}

// 모름(null)은 "창문 없음"이 아니라 모르는 정보로 간다
check(describeSeat(seat), { facts: ['일반석', '창가', '화장실·갤리 근처'], unknowns: ['창문 유무'] })
check(describeSeat({ ...seat, hasWindow: false }), { facts: ['일반석', '창가', '창문 없음', '화장실·갤리 근처'], unknowns: [] })
// 창가가 아닌 좌석은 창문을 따지지 않는다. 비상구 · 넓은 좌석은 좌석 하나 단위다
check(describeSeat({ ...seat, position: 'aisle', hasWindow: false, exitRow: true, extraLegroom: true, noRecline: null }), {
  facts: ['일반석', '통로', '화장실·갤리 근처', '비상구 좌석', '다리 공간 넓음'],
  unknowns: ['등받이 고정 여부'],
})

check(getWingCaption([{ ...seat, overWing: true }, { ...seat, row: 31, overWing: true }, { ...seat, row: 40 }]), '날개 영역  28–31열')
check(getWingCaption([{ ...seat, overWing: null }]), '날개 위치는 항공사가 알려 주지 않았어요')
check(getWingCaption([seat]), null)

console.log('seatMap 확인 통과')

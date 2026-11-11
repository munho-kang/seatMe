// 저장된 Seat Profile 읽기 확인. `npm test`로 돌린다. 틀리면 오류를 내고 멈춘다
import { describeSeatProfile, parseSeatProfile } from './seatProfile.ts'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`기대한 값 ${JSON.stringify(expected)} / 실제 값 ${JSON.stringify(actual)}`)
  }
}

const defaults = { seatPosition: 'prefer-window', sunlight: 5, quietness: 4, turbulence: 4, quickExit: 2, view: 3 }
const saved = { seatPosition: 'always-aisle', sunlight: 1, quietness: 2, turbulence: 3, quickExit: 4, view: 5 }

// 저장한 값은 그대로 돌아온다
check(parseSeatProfile(JSON.stringify(saved)), saved)
// 저장한 적이 없거나 망가진 글자면 기본값
for (const text of [null, '', '{', 'null', '3']) check(parseSeatProfile(text), defaults)
// 틀린 칸만 기본값으로 바꾸고, 모르는 칸은 버린다 (서버로 그대로 실려 가기 때문)
check(parseSeatProfile(JSON.stringify({ ...saved, seatPosition: 'middle', sunlight: 6, view: '5', extra: 1 })), {
  ...saved,
  seatPosition: 'prefer-window',
  sunlight: 5,
  view: 3,
})
// 요약 한 줄은 저장된 값을 그대로 보여 준다
check(describeSeatProfile(parseSeatProfile(null)), '창가 선호 · 햇빛 5 · 조용함 4 · 흔들림 4')
check(describeSeatProfile(parseSeatProfile(JSON.stringify(saved))), '항상 통로 · 햇빛 1 · 조용함 2 · 흔들림 3')

console.log('seatProfile 확인 통과')

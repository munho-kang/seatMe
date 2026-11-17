// 왕복 주소 맞바꾸기 확인. `npm test`로 돌린다. 틀리면 오류를 내고 멈춘다
import { legLabel, otherLeg, skipReturn, swapLeg } from './roundTrip.ts'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`기대한 값 ${JSON.stringify(expected)} / 실제 값 ${JSON.stringify(actual)}`)
  }
}

const values = (params: URLSearchParams) => Object.fromEntries(params)

// 가는 편 목록에서 KE1505를 고른 주소 (김포 → 제주, 11월 20일 ~ 23일)
const search = { from: 'GMP', to: 'CJU', date: '2026-11-20', returnDate: '2026-11-23', passengers: '성인 2명' }
const outbound = { flight: 'KE1505', airline: '대한항공', dep: '08:00', arr: '09:10', seatMap: 'KE-B739-188' }
const picked = new URLSearchParams({ ...search, ...outbound })
check(legLabel(picked), '가는 편')
check(otherLeg(picked), null)

// 오는 편 목록: 노선이 뒤집히고 날짜는 돌아오는 날, 가는 편은 other에 접힌다. 인원 같은 공통 칸은 그대로다
const returnList = swapLeg(picked)
check(values(returnList), {
  returnDate: '2026-11-23',
  passengers: '성인 2명',
  from: 'CJU',
  to: 'GMP',
  date: '2026-11-23',
  other: 'from=GMP&to=CJU&date=2026-11-20&flight=KE1505&airline=%EB%8C%80%ED%95%9C%ED%95%AD%EA%B3%B5&dep=08%3A00&arr=09%3A10&seatMap=KE-B739-188',
  leg: 'return',
})
check(legLabel(returnList), '오는 편')

// 오는 편을 고르고 다시 맞바꾸면 가는 편이 그대로 돌아오고 오는 편이 other에 접힌다
returnList.set('flight', '7C112')
returnList.set('dep', '18:00')
const both = swapLeg(returnList)
check(both.get('leg'), null)
for (const [key, value] of Object.entries({ ...search, ...outbound })) check(both.get(key), value)
check(values(new URLSearchParams(both.get('other') ?? '')), { from: 'CJU', to: 'GMP', date: '2026-11-23', flight: '7C112', dep: '18:00' })
// 두 번 맞바꾸면 제자리다 (가는 편 좌석 → 오는 편 좌석 → 뒤로)
check(values(swapLeg(swapLeg(both))), values(both))
check(otherLeg(both)?.get('flight'), '7C112')

// 오는 편 건너뛰기: 가는 편만 남은 편도 주소
check(values(skipReturn(returnList)), { passengers: '성인 2명', from: 'GMP', to: 'CJU', date: '2026-11-20', ...outbound })

// 편도는 편 이름이 없다
check(legLabel(new URLSearchParams({ from: 'GMP', to: 'CJU', date: '2026-11-20' })), null)

console.log('roundTrip 확인 통과')

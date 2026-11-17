// 예매 링크 · 안내 문구 확인. `npm test`로 돌린다. 틀리면 오류를 내고 멈춘다.
// 기대하는 주소는 2026-11-14에 항공사 사이트에서 직접 열어 확인한 모양 그대로다
import { getBookingGuide, getBookingLink, isBookable, parsePassengers } from './booking.ts'

function check(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`기대한 값 ${JSON.stringify(expected)} / 실제 값 ${JSON.stringify(actual)}`)
  }
}

// 좌석 상세 화면 주소에 실려 오는 값 (김포 → 제주, 11월 21일, 성인 2명)
function params(flight: string, extra: Record<string, string> = {}) {
  return new URLSearchParams({ from: 'GMP', to: 'CJU', date: '2026-11-21', passengers: '성인 2명', flight, ...extra })
}

// 주소에 JSON으로 실리는 값(제주항공 · 아시아나)은 항공사가 받는 내용으로 비교한다
function jsonParam(url: string | undefined, name: string) {
  return JSON.parse(new URL(url ?? '').searchParams.get(name) ?? 'null')
}

// 성인 · 소아 · 유아 수를 서로 다르게 해서, 칸이 뒤바뀌거나 한 명으로 줄면 드러나게 한다
const family = { passengers: '성인 3명, 소아 2명, 유아 1명' }
// 주소에 실린 인원만 꺼내 본다 (대한항공 주소 기준)
function koreanAirPassengers(passengers: string) {
  const query = new URL(getBookingLink(params('KE1505', { passengers }))?.url ?? '').searchParams
  return [query.get('adults'), query.get('children'), query.get('infants')].join('/')
}

// 항공사 온라인 예매가 한 번에 받는 인원: 유아까지 합쳐 9명, 유아는 성인 1명당 1명, 성인은 1명 이상.
// 인원 선택 화면이 이 규칙으로 더하기 · 빼기 버튼을 잠근다
const bookable = [[1, 0, 0], [9, 0, 0], [5, 4, 0], [4, 1, 4], [3, 2, 1]]
for (const [adult, child, infant] of bookable) check(isBookable({ adult, child, infant }), true)
// 10명째 · 유아까지 합쳐 10명 · 성인보다 많은 유아 · 성인 0명 · 0보다 적은 수
const notBookable = [[10, 0, 0], [5, 5, 0], [5, 4, 1], [1, 0, 2], [0, 1, 0], [1, -1, 0], [1, 0, -1]]
for (const [adult, child, infant] of notBookable) check(isBookable({ adult, child, infant }), false)

// 인원 글자를 숫자로 읽는다. 적힌 수 그대로다 (주소를 직접 고치면 범위를 넘는 수도 온다)
check(parsePassengers('성인 3명, 소아 2명, 유아 1명'), { adult: 3, child: 2, infant: 1 })
check(parsePassengers('성인 2명'), { adult: 2, child: 0, infant: 0 })
check(parsePassengers('성인 12명, 소아 12명'), { adult: 12, child: 12, infant: 0 })
// 값이 없거나(좌석 상세 주소를 직접 연 경우) 틀리면 성인 1명
for (const text of [null, '', '여러 명', '성인 0명', '성인 1234명']) check(parsePassengers(text), { adult: 1, child: 0, infant: 0 })

// 대한항공 · 진에어 · 에어부산: 노선 · 날짜 · 편도 · 인원
check(getBookingLink(params('KE1505', family))?.url.split('departureDate=')[1], '2026-11-21&adults=3&children=2&infants=1&cabinClass=Y')
check(getBookingLink(params('LJ305', family))?.url.split('tripType=')[1], 'OW&adultPaxCount=3&childPaxCount=2&infantPaxCount=1&depcity1=GMP&arrcity1=CJU&depdate1=20261121')
check(getBookingLink(params('KE1505')), {
  url: 'https://www.koreanair.com/booking/search?bookingType=R&tripType=OW&departure=GMP&arrival=CJU&departureDate=2026-11-21&adults=2&children=0&infants=0&cabinClass=Y',
  prefilled: true,
})
check(getBookingLink(params('LJ305')), {
  url: 'https://www.jinair.com/booking/index?tripday1=N&tripType=OW&adultPaxCount=2&childPaxCount=0&infantPaxCount=0&depcity1=GMP&arrcity1=CJU&depdate1=20261121',
  prefilled: true,
})
check(getBookingLink(params('BX8011', { from: 'PUS', ...family })), {
  url: 'https://www.airbusan.com/web/individual/booking/flightsAvail?bookingCategory=Individual&onLoadSearchYN=Y&tripType=OW&depCity1=PUS&arrCity1=CJU&depDate1=20261121&passengerCountAdult=3&passengerCountChild=2&passengerCountInfant=1',
  prefilled: true,
})

// 트리니티 · 에어서울: 인원은 받아 주지 않아 노선 · 날짜만 싣는다
check(getBookingLink(params('TW701')), {
  url: 'https://www.trinityairways.com/app/booking/searchItinerary?tripType=OW&depAirportCode=GMP&arrAirportCode=CJU&flightDate=2026-11-21',
  prefilled: true,
})
check(getBookingLink(params('RS901')), {
  url: 'https://flyairseoul.com/I/ko/viewBooking.do?DepApo=GMP&ArrApo=CJU&DepDate=20261121',
  prefilled: true,
})

// 제주항공: 검색 조건을 JSON으로 싣는다. 소아 · 유아는 있을 때만.
// 언어 · 국내선 · 통화 같은 뒤쪽 다섯 칸을 빼면 공항 칸이 비고 항공편 목록이 뜨지 않는다
const jeju = getBookingLink(params('7C101', family))
check(jeju?.url.split('?')[0], 'https://www.jejuair.net/ko/ibe/booking/AvailSearch.do')
check(jeju?.prefilled, true)
check(jsonParam(jeju?.url, 'availSearchData'), {
  tripRoute: [{ originAirport: 'GMP', destinationAirport: 'CJU', flightDate: '2026-11-21' }],
  passengers: [
    { type: 'ADT', count: '3' },
    { type: 'CHD', count: '2' },
    { type: 'INF', count: '1' },
  ],
  tripType: 'OW',
  cultureCode: 'ko-KR',
  domIntType: 'D',
  bookType: 'Common',
  channelCode: 'WPC',
  currencyCode: 'KRW',
})
check(jsonParam(getBookingLink(params('7C101'))?.url, 'availSearchData').passengers, [{ type: 'ADT', count: '2' }])

// 아시아나: 지역 · 도시 코드가 없으면 항공편 목록이 뜨지 않는다. 김포의 도시 코드는 SEL, 나머지는 공항 코드와 같다.
// 승객은 한 사람에 한 칸씩 싣는다
const asiana = getBookingLink(params('OZ8905', family))
check(asiana?.url.split('?')[0], 'https://flyasiana.com/I/KR/KO/RevenueDomesticFlightsSelect.do')
check(jsonParam(asiana?.url, 'bookConditionData'), {
  bizType: 'REV',
  tripType: 'OW',
  domIntType: 'D',
  segmentConditionDatas: [
    {
      departureArea: 'KR',
      departureAirport: 'GMP',
      departureCity: 'SEL',
      departureDateTime: '202611210000',
      arrivalArea: 'KR',
      arrivalAirport: 'CJU',
      arrivalCity: 'CJU',
      cabinClassList: ['E', 'B'],
    },
  ],
  passengerConditionDatas: [
    { passengerType: 'ADT' },
    { passengerType: 'ADT' },
    { passengerType: 'ADT' },
    { passengerType: 'CHD' },
    { passengerType: 'CHD' },
    { passengerType: 'INF' },
  ],
})
const asianaToGimpo = jsonParam(getBookingLink(params('OZ8802', { from: 'PUS', to: 'GMP' }))?.url, 'bookConditionData')
check(asianaToGimpo.segmentConditionDatas[0].departureCity, 'PUS')
check(asianaToGimpo.segmentConditionDatas[0].arrivalCity, 'SEL')

// 이스타: 2026-11-16 개편 뒤 결과 화면이 가격 비교 사이트용 값을 읽는다 (2026-11-17 확인). 편도는 fly_type 2,
// departure0_country_cd가 없으면 아무것도 읽지 않는다
check(getBookingLink(params('ZE201', family)), {
  url: 'https://main.eastarjet.com/schedule?departure0_country_cd=KR&fly_type=2&departure0_cd=GMP&arrival0_cd=CJU&departure0_date_cd=20261121&person1=3&person2=2&person3=1',
  prefilled: true,
})

// 파라타: 주소로 값을 받아 주지 않아 홈페이지로 보낸다
check(getBookingLink(params('WE201')), { url: 'https://www.parataair.com', prefilled: false })

// 왕복으로 검색했어도 편 하나를 편도로 연다 (오는 편은 버튼이 따로다)
check(getBookingLink(params('KE1505', { returnDate: '2026-11-23' })), getBookingLink(params('KE1505')))
// 인원이 주소에 없으면 성인 1명
const noPassengers = params('KE1505')
noPassengers.delete('passengers')
check(new URL(getBookingLink(noPassengers)?.url ?? '').searchParams.get('adults'), '1')
// 항공사 온라인 예매가 받는 범위(유아까지 합쳐 9명, 유아는 성인 수까지) 안이면 그대로 싣는다
check(koreanAirPassengers('성인 4명, 소아 1명, 유아 4명'), '4/1/4')
// 범위를 넘으면(주소를 직접 고친 경우) 틀린 인원을 싣지 않고 항공사 기본값(성인 1명)으로 연다. 적힌 인원은 안내 문구가 알려 준다
for (const text of ['성인 12명', '성인 5명, 소아 5명', '성인 5명, 소아 4명, 유아 1명', '성인 1명, 유아 3명']) {
  check(koreanAirPassengers(text), '1/0/0')
}
// 공항 · 날짜가 틀리면(주소를 직접 고친 경우) 깨진 예매 화면 대신 홈페이지로 보낸다
const wrongValues: Record<string, string>[] = [{ date: '2026-11-2' }, { date: '' }, { from: 'gmp' }, { to: 'JEJU' }]
for (const extra of wrongValues) {
  check(getBookingLink(params('KE1505', extra)), { url: 'https://www.koreanair.com', prefilled: false })
}
// 모르는 항공사 · 편명 없음은 버튼을 보이지 않는다
check(getBookingLink(params('XX123')), undefined)
check(getBookingLink(new URLSearchParams()), undefined)

// 안내 문구: 편명 · 출발 시각 · 편도 · 좌석 · 자리 수(성인 + 소아). 유아는 자리가 없어 따로 적는다.
// 같은 편명이 하루 두 번 뜰 수 있어(예: KE1013 06:30 · 07:35) 출발 시각까지 적는다
check(getBookingGuide(params('KE1505', { dep: '08:00' }), '10F'), 'KE1505 08:00 출발 · 편도 · 좌석 10F · 2명')
check(getBookingGuide(params('KE1505', { dep: '08:00', ...family }), '10F'), 'KE1505 08:00 출발 · 편도 · 좌석 10F · 5명 · 유아 1명')
// 항공사 범위를 넘는 인원도 고른 그대로 적는다
check(getBookingGuide(params('KE1505', { passengers: '성인 12명' }), '10F'), 'KE1505 · 편도 · 좌석 10F · 12명')
// 출발 시각이 주소에 없으면 편명만
check(getBookingGuide(params('KE1505'), '10F'), 'KE1505 · 편도 · 좌석 10F · 2명')

console.log('booking 확인 통과')

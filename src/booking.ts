// 예매 버튼이 여는 항공사 주소와 그 옆 안내 문구. SeatMe는 예매를 받지 않고 항공사 화면으로 연결만 한다.
// 주소 모양은 2026-11-14에 9개 항공사 사이트에서 직접 열어 확인했다. 항공사가 사이트를 고치면 깨질 수 있다
// (아시아나: 대한항공 통합 예정. 이스타는 2026-11-16 개편 뒤 2026-11-17에 다시 확인). 좌석은 어느 항공사도 주소로 받지 않는다
import type { Passengers } from './mocks/flights'

type Trip = Passengers & {
  from: string
  to: string
  // 2026-11-21
  date: string
  // 20261121
  ymd: string
}

// 항공사 공식 사이트 (편명 앞 두 글자 → 주소). 좌석 배치도가 있는 9개 항공사다
const HOMEPAGES: Record<string, string | undefined> = {
  '7C': 'https://www.jejuair.net',
  BX: 'https://www.airbusan.com',
  KE: 'https://www.koreanair.com',
  LJ: 'https://www.jinair.com',
  OZ: 'https://flyasiana.com',
  RS: 'https://flyairseoul.com',
  TW: 'https://www.trinityairways.com',
  WE: 'https://www.parataair.com',
  ZE: 'https://www.eastarjet.com',
}

function withQuery(base: string, values: Record<string, string | number>) {
  return `${base}?${new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]))}`
}

// 항공사 공통 승객 코드(성인 ADT · 소아 CHD · 유아 INF)와 인원. 0명인 칸은 뺀다
function passengerCounts({ adult, child, infant }: Passengers) {
  const counts: [string, number][] = [
    ['ADT', adult],
    ['CHD', child],
    ['INF', infant],
  ]
  return counts.filter(([, count]) => count > 0)
}

// ponytail: 공항이 GMP · CJU · PUS뿐이라 김포만 바꾼다 (제주 · 김해는 도시 코드가 공항 코드와 같다). 공항이 늘면 표로 바꾼다
function asianaCity(airport: string) {
  return airport === 'GMP' ? 'SEL' : airport
}

// 노선 · 날짜가 채워진 예매 화면 주소. 가는 편 편도로만 연다 (추천 좌석이 가는 편 하나에 대한 것이다).
// 파라타는 주소로 값을 받아 주지 않아 여기 없다 (홈페이지로 보낸다)
const BOOKING_PAGES: Record<string, ((trip: Trip) => string) | undefined> = {
  // 항공편 목록이 바로 열린다.
  // 제주항공은 뒤쪽 다섯 칸(언어 · 국내선 · 예매 종류 · 채널 · 통화)을 빼면 공항 칸이 비고 목록이 뜨지 않는다
  '7C': (trip) =>
    withQuery('https://www.jejuair.net/ko/ibe/booking/AvailSearch.do', {
      availSearchData: JSON.stringify({
        tripRoute: [{ originAirport: trip.from, destinationAirport: trip.to, flightDate: trip.date }],
        passengers: passengerCounts(trip).map(([type, count]) => ({ type, count: String(count) })),
        tripType: 'OW',
        cultureCode: 'ko-KR',
        domIntType: 'D',
        bookType: 'Common',
        channelCode: 'WPC',
        currencyCode: 'KRW',
      }),
    }),
  BX: (trip) =>
    withQuery('https://www.airbusan.com/web/individual/booking/flightsAvail', {
      bookingCategory: 'Individual',
      onLoadSearchYN: 'Y',
      tripType: 'OW',
      depCity1: trip.from,
      arrCity1: trip.to,
      depDate1: trip.ymd,
      passengerCountAdult: trip.adult,
      passengerCountChild: trip.child,
      passengerCountInfant: trip.infant,
    }),
  // 지역(Area) · 도시(City) 코드를 빼면 항공편 목록이 끝없이 불러오는 중으로 남는다
  OZ: (trip) =>
    withQuery('https://flyasiana.com/I/KR/KO/RevenueDomesticFlightsSelect.do', {
      bookConditionData: JSON.stringify({
        bizType: 'REV',
        tripType: 'OW',
        domIntType: 'D',
        segmentConditionDatas: [
          {
            departureArea: 'KR',
            departureAirport: trip.from,
            departureCity: asianaCity(trip.from),
            departureDateTime: `${trip.ymd}0000`,
            arrivalArea: 'KR',
            arrivalAirport: trip.to,
            arrivalCity: asianaCity(trip.to),
            cabinClassList: ['E', 'B'],
          },
        ],
        passengerConditionDatas: passengerCounts(trip).flatMap(([passengerType, count]) =>
          Array.from({ length: count }, () => ({ passengerType })),
        ),
      }),
    }),
  // 값이 채워진 검색 화면이 열린다 (검색 버튼은 직접 누른다)
  KE: (trip) =>
    withQuery('https://www.koreanair.com/booking/search', {
      bookingType: 'R',
      tripType: 'OW',
      departure: trip.from,
      arrival: trip.to,
      departureDate: trip.date,
      adults: trip.adult,
      children: trip.child,
      infants: trip.infant,
      cabinClass: 'Y',
    }),
  LJ: (trip) =>
    withQuery('https://www.jinair.com/booking/index', {
      tripday1: 'N',
      tripType: 'OW',
      adultPaxCount: trip.adult,
      childPaxCount: trip.child,
      infantPaxCount: trip.infant,
      depcity1: trip.from,
      arrcity1: trip.to,
      depdate1: trip.ymd,
    }),
  // 인원은 받아 주지 않는다 (1명으로 열린다)
  TW: (trip) =>
    withQuery('https://www.trinityairways.com/app/booking/searchItinerary', {
      tripType: 'OW',
      depAirportCode: trip.from,
      arrAirportCode: trip.to,
      flightDate: trip.date,
    }),
  // 인원 · 편도도 받아 주지 않는다 (왕복 · 1명으로 열린다)
  RS: (trip) =>
    withQuery('https://flyairseoul.com/I/ko/viewBooking.do', { DepApo: trip.from, ArrApo: trip.to, DepDate: trip.ymd }),
  // 항공편 목록이 바로 열린다. 2026-11-16 개편 뒤 결과 화면이 가격 비교 사이트용 값을 읽는다 (fly_type 2 = 편도).
  // departure0_country_cd가 없으면 아무것도 읽지 않는다. 부산↔제주는 운항하지 않아 400이 뜬다 (우리 화면에 그 편이 없다)
  ZE: (trip) =>
    withQuery('https://main.eastarjet.com/schedule', {
      departure0_country_cd: 'KR',
      fly_type: 2,
      departure0_cd: trip.from,
      arrival0_cd: trip.to,
      departure0_date_cd: trip.ymd,
      person1: trip.adult,
      person2: trip.child,
      person3: trip.infant,
    }),
}

// 항공사 온라인 예매가 한 번에 받는 인원. 2026-11-14에 9개 항공사 사이트에서 확인했다: 모두 9명까지이고 유아는 성인 1명당 1명이다.
// 대한항공 · 제주항공 등은 유아를 9명에 넣지 않지만 에어부산 · 아시아나는 넣어 세므로, 어디서나 통하게 가장 엄격한 쪽에 맞춘다
export const MAX_PASSENGERS = 9

// 인원 선택 화면(PassengerSheet)이 이 규칙으로 더하기 · 빼기 버튼을 잠근다
export function isBookable({ adult, child, infant }: Passengers) {
  return adult >= 1 && child >= 0 && infant >= 0 && adult + child + infant <= MAX_PASSENGERS && infant <= adult
}

// 주소의 passengers("성인 2명, 소아 1명" — flights.ts의 formatPassengers가 만든 글자)를 숫자로 읽는다.
// 없거나 틀리면 성인 1명. 적힌 수 그대로 돌려준다 (주소를 직접 고치면 범위를 넘는 수도 온다. 두 자리까지만 읽는다)
export function parsePassengers(text: string | null): Passengers {
  const count = (label: string) => Number(text?.match(new RegExp(`${label} (\\d{1,2})명`))?.[1] ?? 0)
  return { adult: count('성인') || 1, child: count('소아'), infant: count('유아') }
}

// 예매 버튼이 열 주소. prefilled는 노선 · 날짜가 채워진 화면인지다. 모르는 항공사면 undefined (버튼을 보이지 않는다)
export function getBookingLink(searchParams: URLSearchParams) {
  const airline = searchParams.get('flight')?.slice(0, 2) ?? ''
  const homepage = HOMEPAGES[airline]
  if (!homepage) return undefined

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const date = searchParams.get('date') ?? ''
  const bookingPage = BOOKING_PAGES[airline]
  // 주소를 직접 고쳐 공항 · 날짜가 틀렸으면 깨진 예매 화면 대신 홈페이지로 보낸다
  if (!bookingPage || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { url: homepage, prefilled: false }
  }
  const chosen = parsePassengers(searchParams.get('passengers'))
  // 항공사가 받는 범위를 넘으면(주소를 직접 고친 경우) 틀린 인원을 싣지 않고 항공사 기본값(성인 1명)으로 연다.
  // 적힌 인원은 안내 문구가 그대로 알려 준다
  const passengers = isBookable(chosen) ? chosen : { adult: 1, child: 0, infant: 0 }
  return { url: bookingPage({ from, to, date, ymd: date.replaceAll('-', ''), ...passengers }), prefilled: true }
}

// 항공사 화면에서 직접 고를 내용 한 줄. 같은 편명이 하루 두 번 뜰 수 있어 출발 시각까지 적는다.
// 자리 수는 성인 + 소아이고, 유아는 자리가 없어 따로 적는다
export function getBookingGuide(searchParams: URLSearchParams, seat: string) {
  const { adult, child, infant } = parsePassengers(searchParams.get('passengers'))
  const departure = searchParams.get('dep')
  const flight = departure ? `${searchParams.get('flight')} ${departure} 출발` : searchParams.get('flight')
  const infants = infant > 0 ? ` · 유아 ${infant}명` : ''
  return `${flight} · 편도 · 좌석 ${seat} · ${adult + child}명${infants}`
}

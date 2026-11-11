import { useEffect, useState } from 'react'
import { getSeatProfile } from './mocks/seatProfile'

// 서버 GET /api/recommend 응답. 규칙은 서버 RecommendApiTest 머리 주석이 기준이다.
// 서버는 숫자와 항목 이름만 준다. 화면 문구는 각 화면이 항목 이름으로 찾아 쓴다
export type ScoreItem = 'sunlight' | 'view' | 'quietness' | 'turbulence' | 'quickExit' | 'position'

export type RecommendedSeat = {
  rank: number
  seat: string
  score: number
  // 항목별 점수 0~1. null은 0점이 아니라 "계산에서 뺀 항목"이다 (날개 위치를 모르는 배치의 흔들림)
  scores: Record<ScoreItem, number | null>
  // 잘 맞는 항목 (최대 4개, 없을 수 있다)
  features: ScoreItem[]
  // 가장 아쉬운 항목 (없으면 null)
  tradeoff: ScoreItem | null
}

export type Recommendation = {
  aircraft: string
  seatMapId: string
  sun: { left: number; right: number }
  seats: RecommendedSeat[]
  // 출발 · 도착 공항의 기상청 예보로 만든 설명 한 줄. 이것만 서버가 문장으로 준다.
  // 예보가 없거나(4~5일 넘는 비행 · 밤 비행 · 기상청 응답 없음) 붙일 말이 없으면 null
  weatherNote: string | null
}

// 항공편을 고를 때 목록 화면이 주소에 실어 둔 값 (FlightResultsPage.handleSelect)
const FLIGHT_KEYS = ['from', 'to', 'date', 'flight', 'dep', 'arr', 'aircraftCode', 'seatMap']

// 추천 창구 주소. 항공편은 화면 주소에서, 취향은 저장된 Seat Profile에서 가져온다
function getRecommendUrl(searchParams: URLSearchParams) {
  const query = new URLSearchParams()
  for (const key of FLIGHT_KEYS) query.set(key, searchParams.get(key) ?? '')
  for (const [key, value] of Object.entries(getSeatProfile())) query.set(key, String(value))
  return `/api/recommend?${query}`
}

// 같은 주소는 한 번만 부르고 결과를 기억한다. 새로고침하면 비워지고, 실패한 요청은 기억하지 않는다
const requests = new Map<string, Promise<Recommendation>>()
const results = new Map<string, Recommendation>()

function load(url: string) {
  let request = requests.get(url)
  if (!request) {
    request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json() as Promise<Recommendation>
    })
    request.then(
      (data) => results.set(url, data),
      () => requests.delete(url),
    )
    requests.set(url, request)
  }
  return request
}

// 분석 화면이 처음 부른다. 추천 · 비교 · 좌석맵 · 상세 화면은 아래 useRecommendation으로 같은 결과를 쓴다
export function fetchRecommendation(searchParams: URLSearchParams) {
  return load(getRecommendUrl(searchParams))
}

// 추천 결과. undefined면 불러오는 중, null이면 실패다 (useJson과 같은 약속)
export function useRecommendation(searchParams: URLSearchParams) {
  const url = getRecommendUrl(searchParams)
  const [result, setResult] = useState<{ url: string; data: Recommendation | null }>()

  useEffect(() => {
    let isLeaving = false
    load(url).then(
      (data) => !isLeaving && setResult({ url, data }),
      () => !isLeaving && setResult({ url, data: null }),
    )
    return () => {
      isLeaving = true
    }
  }, [url])

  // 이미 받아 둔 결과는 기다리지 않고 바로 쓴다 (화면을 옮길 때 "불러오는 중"이 깜빡이지 않게)
  return results.get(url) ?? (result?.url === url ? result.data : undefined)
}

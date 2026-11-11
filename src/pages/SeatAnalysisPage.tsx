import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import Button from '../components/Button'
import SeatAnalysis, { type SeatAnalysisStatus } from '../components/SeatAnalysis'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { getRouteTitle } from '../mocks/flights'
import { fetchRecommendation } from '../recommend'

// 서버 계산은 순식간이라, 분석 애니메이션이 번쩍하고 끝나지 않게 하는 최소 표시 시간 (임시, 디자인 확인)
const MIN_ANALYSIS_MS = 3000

function SeatAnalysisPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<SeatAnalysisStatus>('analyzing')
  const [hasFailed, setHasFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const route = getRouteTitle(searchParams)

  // 추천 계산과 최소 표시 시간이 둘 다 끝나면 넘어간다. 계산이 실패하면 기다리지 않고 바로 실패 화면이다
  useEffect(() => {
    let isLeaving = false
    const minimumWait = new Promise((resolve) => setTimeout(resolve, MIN_ANALYSIS_MS))
    Promise.all([fetchRecommendation(searchParams), minimumWait]).then(
      () => !isLeaving && setStatus('done'),
      () => !isLeaving && setStatus('failed'),
    )
    return () => {
      isLeaving = true
    }
  }, [searchParams, attempt])

  const handleComplete = useCallback(() => {
    navigate(`/recommend?${searchParams}`, { replace: true })
  }, [navigate, searchParams])

  const handleError = useCallback(() => setHasFailed(true), [])

  const handleBack = useCallback(() => {
    navigate(`/flight/trip?${searchParams}`, { replace: true })
  }, [navigate, searchParams])

  function handleRetry() {
    setStatus('analyzing')
    setHasFailed(false)
    setAttempt(attempt + 1)
  }

  if (hasFailed) {
    return (
      <main className="screen screen--status">
        <header className="status-header">
          <p className="logo">SeatME</p>
          <h1 className="status-heading">좌석 분석 결과</h1>
        </header>

        <div className="route-summary">
          <p className="route-summary-route">{route}</p>
          <p className="route-summary-detail">내 Seat Profile 기준</p>
        </div>

        <StatusMessage icon={alertIcon} title="좌석을 분석하지 못했어요" description="잠시 후 다시 시도해 주세요">
          <Button size="pill" onClick={handleRetry}>
            다시 시도
          </Button>
          <Button size="pill" variant="outline" onClick={handleBack}>
            여행 설정 바꾸기
          </Button>
        </StatusMessage>

        <TabBar />
      </main>
    )
  }

  return (
    <SeatAnalysis
      status={status}
      route={route}
      onComplete={handleComplete}
      onCancel={handleBack}
      onError={handleError}
    />
  )
}

export default SeatAnalysisPage

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import Button from '../components/Button'
import SeatAnalysis, { type SeatAnalysisStatus } from '../components/SeatAnalysis'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { getRouteTitle } from '../mocks/flights'

const MOCK_ANALYSIS_MS = 7500

// 실제 분석 API 전까지 쓰는 임시 함수. API가 생기면 이 함수만 교체한다
function runSeatAnalysis(shouldFail: boolean) {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => (shouldFail ? reject(new Error('mock analysis failed')) : resolve()), MOCK_ANALYSIS_MS)
  })
}

function SeatAnalysisPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<SeatAnalysisStatus>('analyzing')
  const [hasFailed, setHasFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // API 연결 전까지 ?status=error로 분석 실패 화면을 확인한다
  const shouldFail = searchParams.get('status') === 'error'
  const route = getRouteTitle(searchParams)

  useEffect(() => {
    let isLeaving = false
    runSeatAnalysis(shouldFail).then(
      () => !isLeaving && setStatus('done'),
      () => !isLeaving && setStatus('failed'),
    )
    return () => {
      isLeaving = true
    }
  }, [shouldFail, attempt])

  const handleComplete = useCallback(() => {
    navigate(`/recommend?${searchParams}`, { replace: true })
  }, [navigate, searchParams])

  const handleError = useCallback(() => setHasFailed(true), [])

  const handleBack = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    params.delete('status')
    navigate(`/flight/trip?${params}`, { replace: true })
  }, [navigate, searchParams])

  function handleRetry() {
    const params = new URLSearchParams(searchParams)
    params.delete('status')
    setSearchParams(params, { replace: true })
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

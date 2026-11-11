import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import Button from './Button'
import StatusMessage from './StatusMessage'

// 추천 결과가 아직 없을 때(불러오는 중 · 실패) 추천 · 비교 · 좌석 상세 화면이 함께 쓰는 자리
function RecommendStatus({ isFailed }: { isFailed: boolean }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  if (!isFailed) {
    return (
      <p className="loading-text" aria-busy="true">
        추천 결과를 불러오고 있어요
      </p>
    )
  }
  return (
    <StatusMessage icon={alertIcon} title="추천 결과를 불러오지 못했어요" description="잠시 후 다시 시도해 주세요">
      <Button size="pill" onClick={() => navigate(`/recommend/analyzing?${searchParams}`, { replace: true })}>
        다시 분석하기
      </Button>
    </StatusMessage>
  )
}

export default RecommendStatus

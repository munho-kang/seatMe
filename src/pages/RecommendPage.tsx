import { useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import RecommendStatus from '../components/RecommendStatus'
import SelectableCard from '../components/SelectableCard'
import TabBar from '../components/TabBar'
import { getSeatProfile } from '../mocks/seatProfile'
import { useRecommendation, type ScoreItem } from '../recommend'
import './RecommendPage.css'

// 서버가 준 항목 이름을 카드 문구로 바꾸는 표. 문구는 임시다 (디자인 확인).
// position은 원하는 쪽(창가 · 통로)에 따라 달라 아래에서 따로 만든다
const FEATURE_LABELS: Record<Exclude<ScoreItem, 'position'>, string> = {
  sunlight: '햇빛 적음',
  view: '전망 좋음',
  quietness: '비교적 조용',
  turbulence: '흔들림 적음',
  quickExit: '빠른 하차',
}

const TRADEOFF_LABELS: Record<Exclude<ScoreItem, 'position'>, string> = {
  sunlight: '햇빛이 들 수 있어요',
  view: '전망은 보통',
  quietness: '조용함은 보통',
  turbulence: '흔들림은 보통',
  quickExit: '빠른 하차는 보통',
}

function RecommendPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const recommendation = useRecommendation(searchParams)
  // 주소의 seat이 지금 추천 좌석일 때만 선택으로 본다 (취향이 바뀌어 TOP 3가 달라졌을 수 있다)
  const seatParam = searchParams.get('seat')
  const selectedSeat = recommendation?.seats.some((item) => item.seat === seatParam) ? seatParam : null
  const wantedSide = getSeatProfile().seatPosition.endsWith('window') ? '창가' : '통로'

  function handleSelect(seat: string) {
    const params = new URLSearchParams(searchParams)
    params.set('seat', seat)
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="screen screen--tab-bar recommend-screen">
      <header className="screen-header screen-header--caption">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">시트밍님에게 잘 맞는 좌석</h1>
        <p className="screen-caption recommend-caption">평소 취향 + 이번 여행 ‘풍경 보기’ 반영</p>
      </header>

      {!recommendation && <RecommendStatus isFailed={recommendation === null} />}

      <div className="recommend-list">
        {recommendation?.seats.map((item) => (
          <SelectableCard
            key={item.seat}
            className="recommend-card"
            isSelected={selectedSeat === item.seat}
            onSelect={() => handleSelect(item.seat)}
          >
            <span className="recommend-card-head">
              <span className="recommend-card-rank">
                {item.rank}위 - {item.seat}
              </span>
              <span className="recommend-card-score">{item.score}점</span>
            </span>
            <span className="recommend-card-features">
              {item.features.map((feature) => (feature === 'position' ? wantedSide : FEATURE_LABELS[feature])).join(' · ') ||
                '두드러지는 조건 없음'}
            </span>
            <span className="recommend-card-tradeoff">
              아쉬운 점:{' '}
              {item.tradeoff === null
                ? '특별히 없어요'
                : item.tradeoff === 'position'
                  ? `${wantedSide}가 아니에요`
                  : TRADEOFF_LABELS[item.tradeoff]}
            </span>
          </SelectableCard>
        ))}
      </div>

      {selectedSeat && (
        <footer className="screen-footer recommend-footer">
          <Button size="sm" onClick={() => navigate(`/recommend/map?${searchParams}`)}>
            선택 완료
          </Button>
          <Button size="sm" variant="tonal" onClick={() => navigate(`/recommend/compare?${searchParams}`)}>
            TOP 3 한눈에 비교
          </Button>
        </footer>
      )}

      <TabBar />
    </main>
  )
}

export default RecommendPage

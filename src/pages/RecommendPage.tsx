import { useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import SelectableCard from '../components/SelectableCard'
import TabBar from '../components/TabBar'
import './RecommendPage.css'

// 추천 알고리즘 전까지 쓰는 Figma(2014:807) mock 결과
const RECOMMENDED_SEATS = [
  { rank: 1, seat: '12A', score: 92, features: '햇빛 적음 · 창가 · 전망 좋음 · 비교적 조용', tradeoff: '빠른 하차는 보통' },
  { rank: 2, seat: '10A', score: 88, features: '햇빛 적음 · 창가 · 전망 좋음', tradeoff: '화장실과 조금 멀어요' },
  { rank: 3, seat: '15A', score: 85, features: '창가  · 전망 좋음 · 레그룸 보통', tradeoff: '날개 영역에 가까워요' },
]

function RecommendPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSeat = searchParams.get('seat')

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

      <div className="recommend-list">
        {RECOMMENDED_SEATS.map((item) => (
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
            <span className="recommend-card-features">{item.features}</span>
            <span className="recommend-card-tradeoff">아쉬운 점: {item.tradeoff}</span>
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

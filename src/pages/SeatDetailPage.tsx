import { useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import RecommendStatus from '../components/RecommendStatus'
import TabBar from '../components/TabBar'
import { getSeatProfile } from '../mocks/seatProfile'
import { useRecommendation, type ScoreItem } from '../recommend'
import './SeatDetailPage.css'

// 서버가 준 항목 이름을 문장으로 바꾸는 표. 문구는 임시다 (디자인 확인).
// position은 원하는 쪽(창가 · 통로)에 따라 달라 아래에서 따로 만든다
const REASONS: Record<Exclude<ScoreItem, 'position'>, string> = {
  sunlight: '예상 햇빛 노출이 낮아요',
  view: '창밖 전망이 좋은 자리예요',
  quietness: '통행과 소음 영향이 적은 편이에요',
  turbulence: '날개와 가까워 흔들림이 적은 편이에요',
  quickExit: '앞쪽이라 빨리 내릴 수 있어요',
}

const TRADEOFFS: Record<Exclude<ScoreItem, 'position'>, string> = {
  sunlight: '비행 중 햇빛이 들 수 있어요.',
  view: '창밖 전망은 기대하기 어려워요.',
  quietness: '통행이나 소음이 있을 수 있어요.',
  turbulence: '날개에서 멀어 흔들림이 느껴질 수 있어요.',
  quickExit: '앞쪽 출입문과 거리가 있어 빠른 하차는 보통이에요.',
}

function SeatDetailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recommendation = useRecommendation(searchParams)
  // 주소의 seat이 추천 좌석이 아니면(주소를 직접 고친 경우 등) 1위 좌석을 보여 준다
  const detail = recommendation?.seats.find((item) => item.seat === searchParams.get('seat')) ?? recommendation?.seats[0]

  if (!detail) {
    return (
      <main className="screen screen--tab-bar">
        <header className="screen-header">
          <p className="logo">SeatME</p>
        </header>
        <RecommendStatus isFailed={recommendation === null} />
        <TabBar />
      </main>
    )
  }

  const seat = detail.seat
  const wantedSide = getSeatProfile().seatPosition.endsWith('window') ? '창가' : '통로'

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--caption seat-detail-header">
        <p className="logo">SeatME</p>
        <p className="seat-detail-score">{detail.score}점</p>
        <h1 className="screen-title screen-title--route">{seat}</h1>
        <p className="screen-caption">왜 추천했는지, 어떤 점은 아쉬운지까지 확인하고 결정해요.</p>
      </header>

      <div className="seat-detail-boxes">
        <section className="info-box info-box--green">
          <h2>추천 이유</h2>
          {detail.features.length === 0 && <p>특별히 두드러지는 조건은 없어요</p>}
          {detail.features.map((feature) => (
            <p key={feature}>✓ {feature === 'position' ? `원하던 ${wantedSide} 자리예요` : REASONS[feature]}</p>
          ))}
        </section>
        <section className="info-box info-box--yellow">
          <h2>아쉬운 점</h2>
          <p>
            {detail.tradeoff === null
              ? '특별히 아쉬운 점이 없어요.'
              : detail.tradeoff === 'position'
                ? `원하던 ${wantedSide} 자리가 아니에요.`
                : TRADEOFFS[detail.tradeoff]}
          </p>
        </section>
        <section className="info-box info-box--outline">
          <h2>정보 신뢰도</h2>
          <p>좌석 구조 높음 · 햇빛 높음 · 소음 보통 · 흔들림 참고</p>
        </section>
        <section className="info-box info-box--blue">
          <h2>예매 전에</h2>
          <p>SeatMe MVP는 실시간 잔여 좌석을 보장하지 않아요.</p>
          <p>항공사 화면에서 {seat} 가능 여부를 최종 확인해 주세요.</p>
        </section>
      </div>

      <footer className="screen-footer">
        <Button onClick={() => navigate('/booking/complete')}>예매하기</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default SeatDetailPage

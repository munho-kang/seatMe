import { useSearchParams } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import './SeatDetailPage.css'

// Figma(2014:1344)에는 12A 상세만 있다. 다른 좌석 데이터는 좌석 데이터가 준비되면 추가한다
const SEAT_DETAILS = {
  '12A': {
    score: 92,
    reasons: ['예상 햇빛 노출이 낮아요', '창가이고 날개 가림이 적어요', '갤리·화장실과 거리가 있어 통행 영향이 적어요'],
    tradeoffs: ['앞쪽 출입문과 거리가 있어 빠른 하차는 보통이에요.'],
    confidence: '좌석 구조 높음 · 햇빛 높음 · 소음 보통 · 흔들림 참고',
  },
}

function SeatDetailPage() {
  const [searchParams] = useSearchParams()
  const seat = searchParams.get('seat') ?? '12A'
  const detail = SEAT_DETAILS[seat as keyof typeof SEAT_DETAILS] ?? SEAT_DETAILS['12A']

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
          {detail.reasons.map((reason) => (
            <p key={reason}>✓ {reason}</p>
          ))}
        </section>
        <section className="info-box info-box--yellow">
          <h2>아쉬운 점</h2>
          {detail.tradeoffs.map((tradeoff) => (
            <p key={tradeoff}>{tradeoff}</p>
          ))}
        </section>
        <section className="info-box info-box--outline">
          <h2>정보 신뢰도</h2>
          <p>{detail.confidence}</p>
        </section>
        <section className="info-box info-box--blue">
          <h2>예매 전에</h2>
          <p>SeatMe MVP는 실시간 잔여 좌석을 보장하지 않아요.</p>
          <p>항공사 화면에서 {seat} 가능 여부를 최종 확인해 주세요.</p>
        </section>
      </div>

      <footer className="screen-footer">
        <Button>예매하기</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default SeatDetailPage

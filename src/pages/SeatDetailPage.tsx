import { useNavigate, useSearchParams } from 'react-router'
import { getBookingGuide, getBookingLink, parsePassengers } from '../booking'
import Button from '../components/Button'
import RecommendStatus from '../components/RecommendStatus'
import TabBar from '../components/TabBar'
import { getSeatProfile } from '../mocks/seatProfile'
import { useRecommendation, type ScoreItem } from '../recommend'
import { legLabel, otherLeg, swapLeg } from '../roundTrip'
import { addTrip } from '../searchHistory'
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

// 예매 안내 한 줄 + 항공사로 가는 버튼. 편 하나에 대한 것이라 왕복이면 편마다 하나씩 그린다 (leg는 '가는 편' · '오는 편').
// 새 탭으로 연다 (추천 좌석 번호를 보면서 예매할 수 있게). 노선 · 날짜를 받아 주는 항공사는 채워진 예매 화면이 열리고,
// 좌석처럼 주소로 넣을 수 없는 것은 위 한 줄로 알려 준다. 문구는 임시다 (디자인 확인)
function Booking({ params, seat, score, leg }: { params: URLSearchParams; seat: string; score?: number; leg: string | null }) {
  const booking = getBookingLink(params)
  if (!booking) return null
  return (
    <>
      <p className="booking-guide">
        {booking.prefilled ? '노선과 날짜는 채워 뒀어요. 아래는 직접 골라 주세요' : '항공사 화면에서 직접 골라 주세요'}
        <strong>{getBookingGuide(params, seat)}</strong>
      </p>
      <a
        className="button button--primary button--lg"
        href={booking.url}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          addTrip({
            from: params.get('from'),
            to: params.get('to'),
            date: params.get('date'),
            passengers: parsePassengers(params.get('passengers')),
            airline: params.get('airline'),
            flight: params.get('flight'),
            dep: params.get('dep'),
            seat,
            score,
          })
        }
      >
        {leg ? `${leg} 예매하기` : '항공사 사이트에서 예매하기'}
      </a>
    </>
  )
}

function SeatDetailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recommendation = useRecommendation(searchParams)
  // 왕복에서 다른 편(가는 편 화면이면 오는 편, 오는 편 화면이면 가는 편)의 주소 값과 추천. 편도면 null (src/roundTrip.ts)
  const other = otherLeg(searchParams)
  const otherRecommendation = useRecommendation(other ?? searchParams)
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
  const leg = legLabel(searchParams)
  const isReturn = searchParams.get('leg') === 'return'
  const outboundSeat = isReturn ? other?.get('seat') : null

  // 지금 보는 좌석(주소의 seat이 틀렸으면 1위 좌석)을 가는 편 좌석으로 싣고, 오는 편 추천으로 넘어간다
  function handleReturnLeg() {
    const params = new URLSearchParams(searchParams)
    params.set('seat', seat)
    navigate(`/recommend?${swapLeg(params)}`)
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header screen-header--caption seat-detail-header">
        <p className="logo">SeatME</p>
        <p className="seat-detail-score">{detail.score}점</p>
        <h1 className="screen-title screen-title--route">
          {leg && `${leg} `}
          {seat}
        </h1>
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
        {other && !isReturn ? (
          // 왕복의 가는 편: 예매는 오는 편 좌석까지 고른 마지막 화면에서 두 편을 함께 한다
          <Button onClick={handleReturnLeg}>오는 편 좌석 고르기</Button>
        ) : (
          <>
            {other && outboundSeat && (
              <Booking
                params={other}
                seat={outboundSeat}
                score={otherRecommendation?.seats.find((item) => item.seat === outboundSeat)?.score}
                leg="가는 편"
              />
            )}
            <Booking params={searchParams} seat={seat} score={detail.score} leg={leg} />
          </>
        )}
      </footer>

      <TabBar />
    </main>
  )
}

export default SeatDetailPage

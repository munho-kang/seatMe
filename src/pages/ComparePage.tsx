import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import RecommendStatus from '../components/RecommendStatus'
import TabBar from '../components/TabBar'
import { useRecommendation, type RecommendedSeat, type ScoreItem } from '../recommend'
import './ComparePage.css'

// 비교표에 보여 줄 항목 (Figma 2014:946의 줄 순서)
const SCORE_ROWS: { label: string; item: ScoreItem }[] = [
  { label: '햇빛', item: 'sunlight' },
  { label: '전망', item: 'view' },
  { label: '조용함', item: 'quietness' },
  { label: '빠른 하차', item: 'quickExit' },
]

// 아쉬운 항목의 짧은 이름. 문구는 임시다 (디자인 확인)
const TRADEOFF_LABELS: Record<ScoreItem, string> = {
  sunlight: '햇빛',
  view: '전망',
  quietness: '소음',
  turbulence: '흔들림',
  quickExit: '하차',
  position: '자리 위치',
}

// 항목 점수(0~1)를 말로 바꾼다. 기준은 임시다 (디자인 확인). null은 서버가 계산에서 뺀 항목이다.
// "좋음"의 0.7은 서버가 "잘 맞는 항목"으로 치는 기준과 같다. 서버는 0.7 미만에서만 아쉬운 점을 고르니,
// 이 숫자가 다르면 같은 좌석에 "좋음"과 "아쉬운 점"이 함께 뜬다
function getLevel(score: number | null) {
  if (score === null) return '정보 없음'
  return score >= 0.8 ? '매우 좋음' : score >= 0.7 ? '좋음' : '보통'
}

// 1위 좌석 칸은 값이 좋을 때만 강조한다 (Figma: "보통"인 줄과 아쉬운 점은 강조하지 않는다)
function getCompareRows(seats: RecommendedSeat[]) {
  return [
    { label: '좌석', values: seats.map((seat) => seat.seat), isFirstHighlighted: true },
    { label: '적합도', values: seats.map((seat) => `${seat.score}점`), isFirstHighlighted: true },
    ...SCORE_ROWS.map(({ label, item }) => {
      const values = seats.map((seat) => getLevel(seat.scores[item]))
      return { label, values, isFirstHighlighted: values[0] === '매우 좋음' || values[0] === '좋음' }
    }),
    {
      label: '아쉬운 점',
      values: seats.map((seat) => (seat.tradeoff ? TRADEOFF_LABELS[seat.tradeoff] : '없음')),
      isFirstHighlighted: false,
    },
  ]
}

function ComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recommendation = useRecommendation(searchParams)

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header compare-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">세 좌석을 한눈에 비교해요</h1>
        <p className="screen-caption">내가 중요하게 본 조건만 먼저 보여줘요</p>
      </header>

      {recommendation ? (
        <table className="compare-table">
          <tbody>
            {getCompareRows(recommendation.seats).map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                {row.values.map((value, index) => (
                  <td key={index} className={index === 0 && row.isFirstHighlighted ? 'compare-highlight' : undefined}>
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <RecommendStatus isFailed={recommendation === null} />
      )}

      <footer className="compare-nav">
        <Link to={`/recommend?${searchParams}`} className="text-link compare-back">
          추천목록
        </Link>
        <Button size="md" className="compare-map-button" onClick={() => navigate(`/recommend/map?${searchParams}`)}>
          좌석맵에서 보기
        </Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default ComparePage

import { Link, useNavigate, useSearchParams } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import './ComparePage.css'

// Figma(2014:946) mock 비교표. 추천 목록과 좌석이 다른 것은 Figma 그대로다 (DESIGN.md §9 #25)
const COMPARE_ROWS: { label: string; values: string[]; isFirstHighlighted: boolean }[] = [
  { label: '좌석', values: ['12A', '11A', '14A'], isFirstHighlighted: true },
  { label: '적합도', values: ['92점', '88점', '85점'], isFirstHighlighted: true },
  { label: '햇빛', values: ['매우 좋음', '매우 좋음', '좋음'], isFirstHighlighted: true },
  { label: '전망', values: ['매우 좋음', '좋음', '매우 좋음'], isFirstHighlighted: true },
  { label: '조용함', values: ['좋음', '좋음', '보통'], isFirstHighlighted: true },
  { label: '빠른 하차', values: ['보통', '보통', '보통'], isFirstHighlighted: false },
  { label: '아쉬운 점', values: ['하차', '화장실 거리', '날개 근접'], isFirstHighlighted: false },
]

function ComparePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header compare-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">세 좌석을 한눈에 비교해요</h1>
        <p className="screen-caption">내가 중요하게 본 조건만 먼저 보여줘요</p>
      </header>

      <table className="compare-table">
        <tbody>
          {COMPARE_ROWS.map((row) => (
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

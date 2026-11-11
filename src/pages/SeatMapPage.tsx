import { Fragment, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import alertIcon from '../assets/icon-alert-large.svg'
import planeIcon from '../assets/icon-plane-large.svg'
import Button from '../components/Button'
import StatusMessage from '../components/StatusMessage'
import TabBar from '../components/TabBar'
import { useRecommendation } from '../recommend'
import { CABIN_NAMES, describeSeat, getWingCaption, type Seat, type SeatMap } from '../seatMap'
import { useJson } from '../useJson'
import './SeatMapPage.css'

const FACILITY_NAMES = { lavatory: '화장실', galley: '갤리', exit: '비상구' }

// 배치도 하나를 그린다. 좌석 위치는 cabins의 글자 순서(띄어쓴 곳이 통로)와 좌석의 열 번호 · 글자로 정한다
function SeatPlan({ seatMap }: { seatMap: SeatMap }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // 정보를 보려고 누른 좌석. 추천 좌석 선택(URL의 seat)과 따로 둔다
  const [viewedSeat, setViewedSeat] = useState<string>()

  const seats = new Map(seatMap.seats.map((seat) => [seat.seat, seat]))
  // 추천 TOP 3. 주소의 seatMap으로 계산하니 다른 배치를 고르면 그 배치로 다시 계산된다.
  // 추천을 못 받았으면(불러오는 중 · 실패) 추천 표시 없이 배치도만 보여 준다
  const recommendation = useRecommendation(searchParams)
  const recommendedSeats = (recommendation?.seats ?? []).map((item) => item.seat).filter((seat) => seats.has(seat))
  const seatParam = searchParams.get('seat')
  const selectedSeat = seatParam && recommendedSeats.includes(seatParam) ? seatParam : recommendedSeats.at(0)
  const viewed = seats.get(viewedSeat ?? '') ?? seats.get(selectedSeat ?? '')
  const seatInfo = viewed && describeSeat(viewed)
  const wingCaption = getWingCaption(seatMap.seats)
  const hasExitSeat = seatMap.seats.some((seat) => seat.exitRow)

  function handleSeat(seat: string) {
    setViewedSeat(seat)
    if (!recommendedSeats.includes(seat)) return
    const params = new URLSearchParams(searchParams)
    params.set('seat', seat)
    setSearchParams(params, { replace: true })
  }

  function handleDetail() {
    if (!selectedSeat) return
    const params = new URLSearchParams(searchParams)
    params.set('seat', selectedSeat)
    navigate(`/recommend/seat?${params}`)
  }

  function renderSeat(seat: Seat | undefined, key: number) {
    // 그 열에 없는 좌석은 자리만 비워 둔다
    if (!seat) return <span key={key} className="seat seat--none" />
    const isRecommended = recommendedSeats.includes(seat.seat)
    const classes = [
      'seat',
      seat.seat === selectedSeat ? 'seat--selected' : isRecommended && 'seat--recommended',
      // 비상구 좌석은 좌석 하나 단위다 (한 열의 일부만 비상구 좌석인 배치가 있다)
      seat.exitRow && 'seat--exit',
      seat === viewed && 'seat--viewed',
    ]
    return (
      <button
        key={key}
        type="button"
        className={classes.filter(Boolean).join(' ')}
        aria-label={`${isRecommended ? '추천 좌석 ' : ''}${seat.seat}${seat.exitRow ? ' 비상구 좌석' : ''}`}
        aria-pressed={seat === viewed}
        onClick={() => handleSeat(seat.seat)}
      >
        {seat.column}
      </button>
    )
  }

  // 그 열 바로 뒤의 화장실 · 갤리 · 비상구를 왼쪽 / 가운데 / 오른쪽으로 나눠 적는다
  function renderFacilities(afterRow: number) {
    const facilities = seatMap.facilities.filter((facility) => facility.afterRow === afterRow)
    if (!facilities.length) return null
    // 같은 자리에 같은 시설이 둘이면(가운데 갤리 둘 등) 이름은 한 번만 적는다
    const namesOn = (side: 'left' | 'center' | 'right') =>
      [
        ...new Set(
          facilities
            .filter((facility) => facility.side === side || (facility.side === 'both' && side !== 'center'))
            .map((facility) => FACILITY_NAMES[facility.type]),
        ),
      ].join(' · ')
    return (
      <div className="seat-facilities">
        <span>{namesOn('left')}</span>
        <span>{namesOn('center')}</span>
        <span>{namesOn('right')}</span>
      </div>
    )
  }

  return (
    <>
      <section className="seat-map">
        <p className="seat-map-front">▲ FRONT / 출입문</p>
        <div className="seat-map-rows">
          {renderFacilities(0)}
          {seatMap.cabins.map((cabin, index) => (
            <Fragment key={cabin.fromRow}>
              {cabin.class !== seatMap.cabins[index - 1]?.class && <p className="seat-cabin">{CABIN_NAMES[cabin.class]}</p>}
              {Array.from({ length: cabin.toRow - cabin.fromRow + 1 }, (_, offset) => cabin.fromRow + offset).map((row) => (
                <Fragment key={row}>
                  {/* 좌석이 하나도 없는 열 번호는 줄을 그리지 않는다 */}
                  {[...cabin.seats].some((column) => seats.has(`${row}${column}`)) && (
                    <div className="seat-row">
                      <span className="seat-row-number">{row}</span>
                      <div className="seat-row-seats">
                        {[...cabin.seats].map((column, position) =>
                          column === ' ' ? (
                            <span key={position} className="seat-aisle" />
                          ) : (
                            renderSeat(seats.get(`${row}${column}`), position)
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {renderFacilities(row)}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
        {wingCaption && <p className="seat-map-wing">{wingCaption}</p>}
        {(recommendedSeats.length > 0 || hasExitSeat) && (
          <p className="seat-map-legend">
            {recommendedSeats.length > 0 && (
              <span>
                <i className="seat-legend-mark seat--recommended" />
                추천 좌석
              </span>
            )}
            {hasExitSeat && (
              <span>
                <i className="seat-legend-mark seat--exit" />
                비상구 좌석
              </span>
            )}
          </p>
        )}
      </section>

      {/* 좌석 정보 칸은 처음부터 자리를 차지한다 (좌석을 누른 뒤에 나타나면 방금 누른 좌석을 가린다) */}
      <footer className="screen-footer seat-map-footer">
        <div className="seat-info" aria-live="polite">
          {viewed && seatInfo ? (
            <>
              <p className="seat-info-title">{viewed.seat}</p>
              <p>{seatInfo.facts.join(' · ')}</p>
              {seatInfo.unknowns.length > 0 && <p>항공사가 알려 주지 않은 정보: {seatInfo.unknowns.join(' · ')}</p>}
            </>
          ) : (
            <p>좌석을 누르면 좌석 정보를 볼 수 있어요</p>
          )}
        </div>
        {selectedSeat && <Button onClick={handleDetail}>{selectedSeat} 자세히 보기</Button>}
      </footer>
    </>
  )
}

function SeatMapPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // 항공편을 고를 때 목록 화면이 URL에 실어 둔 값이다 (FlightResultsPage.handleSelect)
  const seatMapId = searchParams.get('seatMap')
  const candidates = searchParams.get('seatMaps')?.split(',').filter(Boolean) ?? []
  // 값이 없으면 확정이 아닌 것으로 본다 (모르는데 확정인 것처럼 보이면 안 된다)
  const isConfirmed = searchParams.get('seatMapConfirmed') === 'true'

  const { data: seatMap, retry } = useJson<SeatMap>(seatMapId ? `/api/seatmaps/${encodeURIComponent(seatMapId)}` : null)
  // 후보가 여럿일 때만, 고르기 칸에 보여 줄 배치 이름을 받는다
  const { data: summary } = useJson<{ seatMaps: { id: string; name: string }[] }>(
    candidates.length > 1 ? '/api/seatmaps' : null,
  )
  const candidateNames = new Map(summary?.seatMaps.map(({ id, name }) => [id, name]))

  // 두 기종이 함께 쓰는 배치는 배치도의 기종 이름이 하나뿐이라, 항공편의 기종 이름을 먼저 쓴다
  const aircraft = searchParams.get('aircraft') || seatMap?.aircraft

  function handleCandidate(id: string) {
    const params = new URLSearchParams(searchParams)
    params.set('seatMap', id)
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="screen screen--tab-bar">
      <header className="screen-header seat-map-header">
        <p className="logo">SeatME</p>
        <h1 className="screen-title screen-title--route">{aircraft ? `${aircraft} 좌석맵` : '좌석맵'}</h1>
        {seatMap && <p className="screen-caption">{seatMap.seatCount}석</p>}
      </header>

      {seatMapId && !isConfirmed && (
        <div className="seat-map-notice">
          <p>같은 기종이라도 좌석 배치가 여러 가지예요. 실제로 타는 비행기와 다를 수 있어요.</p>
          {candidates.length > 1 && (
            <label>
              다른 배치 보기
              <select value={seatMapId} onChange={(event) => handleCandidate(event.target.value)}>
                {candidates.map((id) => (
                  <option key={id} value={id}>
                    {candidateNames.get(id) ?? id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {!seatMapId ? (
        <StatusMessage icon={planeIcon} title="이 항공편은 좌석 배치도가 아직 없어요" description="기종이 정해지면 볼 수 있어요">
          <Button size="pill" onClick={() => navigate(-1)}>
            이전으로
          </Button>
        </StatusMessage>
      ) : seatMap === undefined ? (
        <p className="loading-text" aria-busy="true">
          좌석 배치도를 불러오고 있어요
        </p>
      ) : seatMap === null ? (
        <StatusMessage
          icon={alertIcon}
          title="좌석 배치도를 불러오지 못했어요"
          description="인터넷 연결을 확인한 뒤 다시 시도해 주세요"
        >
          <Button size="pill" onClick={retry}>
            다시 시도
          </Button>
        </StatusMessage>
      ) : (
        <SeatPlan seatMap={seatMap} />
      )}

      <TabBar />
    </main>
  )
}

export default SeatMapPage

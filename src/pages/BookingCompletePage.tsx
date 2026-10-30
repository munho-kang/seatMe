import { useNavigate } from 'react-router'
import Button from '../components/Button'
import TabBar from '../components/TabBar'
import circleImage from '../assets/booking-circle.svg'
import checkImage from '../assets/booking-check.svg'
import './BookingCompletePage.css'

function BookingCompletePage() {
  const navigate = useNavigate()

  return (
    <main className="screen screen--tab-bar">
      <p className="logo">SeatME</p>

      <div className="booking-result">
        <span className="booking-check">
          <img src={circleImage} alt="" width={150} height={150} />
          <img src={checkImage} alt="" width={50.9491} height={40.5407} className="booking-check-mark" />
        </span>
        <h1 className="booking-title">예매 완료</h1>
      </div>

      <footer className="screen-footer">
        <Button onClick={() => navigate('/home')}>홈으로</Button>
      </footer>

      <TabBar />
    </main>
  )
}

export default BookingCompletePage

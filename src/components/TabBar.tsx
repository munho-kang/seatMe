import { Link } from 'react-router'
import planeIcon from '../assets/icon-plane.svg'
import homeIcon from '../assets/icon-home.svg'
import personIcon from '../assets/icon-person.svg'
import './TabBar.css'

function TabBar() {
  return (
    <nav className="tab-bar">
      <button type="button" className="tab-bar-item" aria-label="내 여행">
        <img src={planeIcon} alt="" width={20.28} height={17.43} />
      </button>
      <Link to="/home" className="tab-bar-item" aria-label="홈">
        <img src={homeIcon} alt="" width={20} height={20.24} />
      </Link>
      <button type="button" className="tab-bar-item" aria-label="마이">
        <img src={personIcon} alt="" width={19.47} height={22} />
      </button>
    </nav>
  )
}

export default TabBar

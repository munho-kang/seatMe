import { useNavigate } from 'react-router'
import './PrivacyPage.css'

// 개인정보 처리방침 (개인정보 보호법 제30조). 서버가 실제로 보관하는 것이 바뀌면 여기도 고친다 (server/auth/email.ts 머리 주석)
const OPERATOR = '강문호'
const CONTACT = 'munhooo55@gmail.com'
const EFFECTIVE = '2026년 11월 17일'

function PrivacyPage() {
  const navigate = useNavigate()

  return (
    <main className="screen privacy">
      <header>
        <p className="logo">SeatME</p>
        <h1 className="screen-title">개인정보 처리방침</h1>
      </header>

      <p>
        SeatMe(이하 "서비스")는 이용자의 개인정보를 개인정보 보호법에 따라 처리하고 안전하게 관리합니다.
        서비스는 로그인 없이도 쓸 수 있고, 로그인은 좌석 취향과 기록을 여러 기기에서 쓰고 싶을 때만 필요합니다.
      </p>

      <h2>1. 처리하는 개인정보와 목적</h2>
      <table>
        <thead>
          <tr><th>언제</th><th>항목</th><th>목적</th></tr>
        </thead>
        <tbody>
          <tr><td>이메일로 가입</td><td>이메일 주소, 비밀번호, 닉네임</td><td>회원 확인 · 로그인, 화면에 이름 표시</td></tr>
          <tr><td>네이버로 로그인</td><td>네이버 이용자 식별값 (이름 · 이메일 · 전화번호는 받지 않음)</td><td>회원 확인 · 로그인</td></tr>
          <tr><td>로그인한 뒤 저장</td><td>좌석 취향(Seat Profile), 최근 검색 · 고른 좌석 · 여행 기록과 별점</td><td>좌석 추천, 여러 기기에서 같은 기록 보기</td></tr>
          <tr><td>인증번호 요청</td><td>이메일 주소</td><td>가입 · 비밀번호 찾기 때 메일 주인 확인</td></tr>
          <tr><td>서비스 이용 중 자동으로</td><td>접속 IP 주소, 로그인 쿠키, 서버 오류 기록</td><td>지나친 로그인 시도 막기, 로그인 유지, 오류 고치기</td></tr>
        </tbody>
      </table>
      <p>
        비밀번호는 되돌릴 수 없게 바꾼 값(PBKDF2)으로만 보관하며, 운영자도 원래 비밀번호를 알 수 없습니다.
        로그인하지 않았을 때의 좌석 취향과 기록은 서버로 보내지 않고 이용자 기기(브라우저)에만 저장합니다.
      </p>

      <h2>2. 보관 기간과 파기</h2>
      <ul>
        <li>회원 정보 · 좌석 취향 · 기록: 회원 탈퇴할 때까지. 탈퇴하면 바로 지웁니다.</li>
        <li>인증번호: 10분 동안만 쓸 수 있고 쓰면 바로 지웁니다. 이메일 원문은 남기지 않습니다.</li>
        <li>접속 IP 주소: 시도 횟수를 세는 1분 동안만 쓰고 데이터베이스에 저장하지 않습니다.</li>
        <li>로그인 쿠키: 180일 (로그아웃 · 탈퇴하면 지움).</li>
        <li>서버 오류 기록: Cloudflare에 며칠 동안 남았다가 자동으로 지워집니다.</li>
      </ul>
      <p>지울 때는 데이터베이스에서 되살릴 수 없게 삭제합니다.</p>

      <h2>3. 제3자 제공</h2>
      <p>이용자의 개인정보를 다른 사람이나 회사에 제공하지 않습니다. 법령에 따른 요청이 있을 때만 예외입니다.</p>

      <h2>4. 처리 위탁과 국외 이전</h2>
      <p>서비스를 운영하려고 아래 회사에 일을 맡기며, 이 과정에서 개인정보가 국외 서버에 보관 · 전송됩니다.</p>
      <table>
        <thead>
          <tr><th>회사 (나라)</th><th>맡기는 일</th><th>옮겨지는 항목</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><a href="https://www.cloudflare.com/privacypolicy/">Cloudflare, Inc.</a> (미국, 데이터는 아시아 지역 서버)</td>
            <td>서버 운영, 회원 정보 · 기록 보관</td>
            <td>1번의 모든 항목</td>
          </tr>
          <tr>
            <td><a href="https://www.brevo.com/legal/privacypolicy/">Brevo SAS</a> (프랑스)</td>
            <td>인증번호 메일 보내기</td>
            <td>이메일 주소, 인증번호</td>
          </tr>
        </tbody>
      </table>
      <p>
        이용자가 서비스를 쓸 때마다 인터넷으로 전송되며, 보관 기간은 2번과 같습니다.
        국외 이전을 원하지 않으면 가입하지 않고(로그인 없이) 쓰거나 탈퇴할 수 있습니다.
      </p>

      <h2>5. 이용자의 권리</h2>
      <p>
        이용자는 언제든 자기 개인정보를 보거나 고치거나 지우라고, 또는 처리를 멈추라고 요구할 수 있습니다.
        좌석 취향은 마이 › Seat Profile 관리에서 고치고, 회원 탈퇴는 마이 › 회원 탈퇴에서 바로 할 수 있습니다.
        그 밖의 요구는 아래 연락처로 보내 주시면 지체 없이 처리합니다.
      </p>

      <h2>6. 안전하게 지키는 방법</h2>
      <ul>
        <li>모든 통신은 암호화(HTTPS)합니다.</li>
        <li>비밀번호와 인증번호는 되돌릴 수 없게 바꾼 값으로만 보관합니다.</li>
        <li>로그인 쿠키는 서명해서 위조할 수 없고, 화면 코드가 읽지 못하게(HttpOnly) 합니다.</li>
        <li>데이터베이스와 인증키는 운영자만 접근할 수 있습니다.</li>
      </ul>

      <h2>7. 쿠키와 기기 저장</h2>
      <p>
        로그인을 유지하려고 쿠키 하나를 씁니다. 광고 · 분석용 쿠키는 쓰지 않습니다.
        로그인하지 않았을 때의 취향 · 기록은 브라우저 저장소(localStorage)에 두며, 브라우저 설정에서 쿠키와 사이트 데이터를 지우면 함께 지워집니다.
      </p>

      <h2>8. 개인정보 보호책임자</h2>
      <p>
        이름: {OPERATOR}
        <br />
        이메일: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <h2>9. 권익 침해 구제</h2>
      <p>개인정보 침해로 상담이나 구제가 필요하면 아래 기관에 문의할 수 있습니다.</p>
      <ul>
        <li>개인정보침해신고센터: (국번 없이) 118, privacy.kisa.or.kr</li>
        <li>개인정보분쟁조정위원회: 1833-6972, www.kopico.go.kr</li>
        <li>대검찰청: (국번 없이) 1301, www.spo.go.kr</li>
        <li>경찰청: (국번 없이) 182, ecrm.police.go.kr</li>
      </ul>

      <h2>10. 바뀔 때</h2>
      <p>이 방침은 {EFFECTIVE}부터 적용됩니다. 내용이 바뀌면 시행 7일 전에 이 화면에 알립니다.</p>

      <button
        type="button"
        className="text-link privacy-back"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      >
        이전
      </button>
    </main>
  )
}

export default PrivacyPage

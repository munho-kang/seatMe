# SeatMe

## 화면 켜기 (React + Vite)

```sh
npm install
npm run dev          # http://localhost:5173
```

## 서버 켜기 (Java 21, Spring Boot)

```sh
cd seatMe
./gradlew bootRun    # http://localhost:8080 — 화면의 /api/... 요청이 여기로 넘어온다
./gradlew test       # 테스트
```

서버는 `seatMe/.env.local` 파일에서 공공데이터 인증키 두 개를 읽는다. 파일을 만들고 아래 두 줄을 넣는다.

```
MOLIT_SERVICE_KEY=...
KAC_API_KEY=...
```

키 값은 팀 메신저로 받는다. 이 파일은 저장소에 올라가지 않는다 (절대 커밋하지 않기).

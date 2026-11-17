# SeatMe

- 서비스: https://seatme.bus-relay.workers.dev
- 저장소: https://github.com/munho-kang/seatMe

화면(React + Vite, `src/`)과 서버(TypeScript, `server/`)가 한 저장소에 있고, Cloudflare Worker 하나로 같이 배포된다.

## 내 컴퓨터에서 켜기

터미널 두 개를 쓴다.

```sh
npm install
npm run dev          # 화면  http://localhost:5173
npm run server       # 서버  http://localhost:8787 — 화면의 /api/... 요청이 여기로 넘어온다
```

서버는 `.dev.vars` 파일에서 공공데이터 인증키 세 개를 읽는다. 파일을 만들고 아래 세 줄을 넣는다.

```
MOLIT_SERVICE_KEY=...
KAC_API_KEY=...
KMA_SERVICE_KEY=...
```

키 값은 팀 메신저로 받는다. 이 파일은 저장소에 올라가지 않는다 (절대 커밋하지 않기).

## 확인

```sh
npm test             # 화면 검사 + 서버 테스트
npm run lint
npm run build        # 타입 검사 + 화면 빌드 (dist/)
```

## 배포 (Cloudflare)

```sh
npx wrangler login   # 처음 한 번
npm run deploy       # 화면을 빌드해서 서버와 함께 올린다
```

- 설정은 `wrangler.jsonc`. `placement` 줄(서울)은 지우면 안 된다 — 없으면 서버가 미국에서 돌아 공공데이터가 몇 초씩 걸린다.
- 인증키는 Cloudflare 비밀 보관함에 있다. 키를 바꿀 때: `npx wrangler secret bulk .dev.vars`
- 좌석 배치도 파일(`server/seatmaps/*.json`)을 더하면 `server/seatmaps/index.ts`에도 한 줄 적는다 (잊으면 테스트가 실패한다).

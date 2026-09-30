# CLAUDE.md

이 문서가 SeatMe의 기획서이자 개발 규칙이다. 별도 기획서는 없다.

## 현재 단계

**Figma 디자인을 React 웹 화면으로 옮기는 단계다.**

- 화면(UI) 구현만 한다. 표시할 데이터는 최소한의 mock 데이터로 채운다.
- 백엔드, API, 로그인, 점수 계산, 햇빛 계산 같은 로직은 구현하지 않는다. 디자인을 모두 옮긴 뒤 개발 단계에서 진행한다.
- 버튼이나 링크의 실제 동작이 로직에 의존하면 화면 이동 정도만 연결하고, 로직은 비워 둔다.
- 앱은 나중에 만든다. 지금은 웹만 구현한다.

---

## 서비스 요약

SeatMe(시트미)는 사용자의 좌석 선호와 항공편 상황을 분석해서, 그 항공편에서 **사용자에게 가장 적합한 실제 좌석 TOP 3**를 추천하는 서비스다.

> **좋은 좌석이 아니라, 나에게 좋은 좌석.**

- 대상: 국내선(김포↔제주, 부산↔제주, 김포↔부산 등) 중 SeatMe가 좌석 데이터를 가진 항공편
- 결제나 좌석 예약은 하지 않는다. 좌석을 고르면 항공사 공식 예매 / 좌석지정 페이지로 이동한다.

**사용자 플로우**
출발·도착 공항과 날짜 입력 → 항공편 선택 → 예정 기종 확인 → Seat Profile 적용 또는 이번 비행 선호 설정 → 좌석 분석 → BEST 3 추천 → 추천 이유와 아쉬운 점 확인 → 전체 Seat Map 확인 → 항공사 페이지로 이동

**선호 조건 8개** (코드에서는 이 이름으로 통일한다)

| 조건 | 판단 기준 |
|---|---|
| 햇빛 | 운항 방향 · 시간 · 태양 위치 |
| 흔들림 | 기체 내 상대적 위치 |
| 조용함 | 엔진 · 갤리 · 화장실 · 출입문과의 거리 |
| 빠른 하차 | 주요 출입문과의 거리 |
| 화장실 접근 | 화장실과의 거리 |
| 전망 | 창가 여부 · 날개 가림 · 창문 정렬 |
| 레그룸 | 좌석 pitch · 비상구 · extra legroom |
| 충전 | 전원 · USB 유무 |

**주요 개념**
- **Seat Fit Score**: 좌석이 사용자 선호에 맞는 정도를 나타내는 적합도 점수. 계산 방식은 개발 단계에서 정한다.
- **Seat Profile**: 사용자가 평소에 쓰는 기본 선호. "이번 여행만 변경"은 기본 프로필을 덮어쓰지 않는다.
- **간편 추천 프리셋**: 햇빛이 싫어요 / 편하게 자고 싶어요 / 멀미가 걱정돼요 / 빨리 내리고 싶어요 / 풍경을 보고 싶어요 / 넓은 자리가 좋아요
- **데이터 신뢰도**: 항목마다 정보의 확실성이 다르다. 화면에서는 ●●● / ●●○ / ●○○로 표시한다.
- **추천 결과**: 순위, 좌석번호, 적합도, 좋은 점(✓), 아쉬운 점(△), 정보 신뢰도, 전체 Seat Map, 다른 조건 적용

---

## 화면 문구 규칙

디자인에 문구가 있으면 디자인 문구를 그대로 쓴다. mock 데이터나 문구를 새로 넣을 때는 아래 규칙을 따른다.

- 적합도는 `92점`처럼 표시한다. `92%`, `92% 확률`, `92% 적합`처럼 쓰지 않는다. 확률이 아니기 때문이다.
- 운항 환경이나 개인차에 따라 달라지는 내용은 단정하지 않는다.
  - 금지: "흔들리지 않습니다", "조용한 좌석입니다", "햇빛이 절대 들어오지 않습니다", "이 좌석이 가장 좋습니다"
  - 사용: "예상 소음", "예상 햇빛 노출", "상대적으로 조용한 위치", "햇빛 노출이 낮은 편"
- 추천 이유는 사용자의 선호와 연결해서 쓴다. 예: "햇빛을 피하면서 창밖을 보고 싶은 당신에게 잘 맞아요."
- 기종은 확정된 사실처럼 쓰지 않는다. 예: "현재 확인된 예정 기종 기준 추천입니다."
- "예약 가능한 좌석입니다", "현재 이 좌석이 남아 있습니다"처럼 좌석이 남아 있다고 단정하는 문구는 쓰지 않는다.

---

## 기술 스택

| 항목 | 사용 기술 |
|---|---|
| UI | React 19 |
| 언어 | TypeScript 6 (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`) |
| 빌드 / Dev 서버 | Vite 8 + `@vitejs/plugin-react` |
| Lint | oxlint (`.oxlintrc.json`) |
| 스타일링 | 일반 CSS (토큰은 `src/index.css`의 CSS 변수) |
| Router | react-router (`BrowserRouter` + `Routes`) |
| 폰트 | Pretendard (index.html에서 jsDelivr CDN 로드) |
| 상태관리 / UI 라이브러리 / Formatter | 없음 (미결정) |

미결정 항목은 임의로 설치하지 않는다. 필요해지면 사용자에게 먼저 묻고, 결정되면 이 표를 갱신한다.

```bash
npm run dev       # 개발 서버
npm run build     # tsc -b 타입 체크 + vite build
npm run lint      # oxlint
```

```
index.html        # lang="ko", title SeatMe
src/main.tsx      # React 루트
src/App.tsx       # 최상위 컴포넌트
src/index.css     # 디자인 토큰(CSS 변수), reset, 공통 화면 레이아웃(.screen, .info-card 등)
src/components/   # Global 컴포넌트 (Button, ScaleSelector, SelectableCard, TabBar) — 컴포넌트별 .css를 옆에 둔다
src/pages/        # 라우트별 Page (Landing, Login, NaverConsent, Signup, Onboarding, Home, FlightSearch, FlightResults, TripSetting, Recommend, Compare, SeatDetail) + 페이지 CSS
src/mocks/        # 여러 화면이 함께 쓰는 mock 데이터 (공항, 항공편)
src/assets/       # 이미지 asset (소셜 로그인 아이콘, 탭바 아이콘)
```
폴더(`components/`, `pages/`, `assets/` 등)는 필요할 때 만들고 여기에 기록한다.

---

## 작업 순서

1. 이 문서를 확인한다. 이미 적힌 구조와 스택은 다시 분석하지 않는다.
2. `DESIGN.md`가 있으면 확인한다. 거기 정리된 토큰과 패턴은 Figma에서 다시 추출하지 않는다.
3. 관련 기존 코드(컴포넌트, hook, util, 스타일)를 검색한다.
4. Figma MCP로 구현할 화면만 확인한다. breakpoint별 디자인도 확인한다.
5. 기존 컴포넌트를 재사용해서 구현한다.
6. 확인한다: `npm run build`, `npm run lint`, 사용하지 않는 코드, 중복 컴포넌트, Figma와의 차이, 반응형.
7. 변경한 파일과 핵심 변경사항만 짧게 보고한다. 전체 코드를 출력하지 않는다. 확인하지 못한 항목은 확인하지 못했다고 쓴다.

---

## 개발 원칙

**Figma 디자인을 최대한 정확하게 구현하되, 가장 단순하고 유지보수하기 쉬운 React 코드로 구현한다.**
목표는 코드 양을 줄이는 것이 아니라 불필요한 복잡성을 줄이는 것이다.

- 요청한 작업에 필요한 파일만 읽고 수정한다.
- 요청하지 않은 기능, 화면, 로직, 파일, dependency를 추가하지 않는다.
- 잘 작동하는 기존 코드를 불필요하게 리팩터링하지 않는다.
- 같은 UI와 로직을 중복해서 만들지 않는다.
- 추상화, generic, custom hook은 실제로 필요할 때만 만든다.
- 다른 값으로 계산할 수 있는 것은 state로 만들지 않는다. 불필요한 `useEffect`를 쓰지 않는다.
- 사용하지 않는 import, 변수, props를 남기지 않는다.
- 코드만 봐도 알 수 있는 내용은 주석으로 쓰지 않는다.
- 새 npm package는 기존 코드나 직접 구현으로 해결할 수 없고 필요성이 분명할 때만, 사용자에게 알리고 추가한다.

## Figma / 스타일 규칙

- Figma에 없는 UI를 추가하지 않는다. 코드를 짜기 쉽게 하려고 디자인을 바꾸지 않는다.
- 디자인이 모호하거나 구현이 어려우면 구현 전에 사용자에게 묻는다.
- 색상, spacing, radius, typography, shadow는 한 곳(CSS 변수 또는 `DESIGN.md` 토큰)에서 정의하고 재사용한다. 임의의 값을 만들지 않는다.
- 이미지와 아이콘은 한 assets 위치에 두고 중복 저장하지 않는다.
- 반응형은 Figma의 Desktop / Tablet / Mobile 디자인을 따른다. width만 줄이지 말고 배치, 순서, 노출 요소 변화를 반영한다. Figma에 없는 breakpoint 디자인은 사용자에게 묻는다.
- breakpoint 값은 한 곳에서 정의한다.

## 컴포넌트 / 파일 규칙

- **Global**: 여러 기능에서 반복되는 UI (Header, Button, Input, Modal, Card)
- **Feature**: 특정 기능에서 반복되는 UI (FlightCard, SeatMap, SeatRecommendationCard 등)
- **Page**: 한 페이지에서만 쓰는 UI. 단순한 마크업은 분리하지 않는다.
- 새로 만들기 전에 같은 역할의 컴포넌트가 이미 있는지 확인한다.
- props가 너무 많아지거나 boolean 분기가 늘어나면 구조를 다시 검토한다.
- 파일을 잘게 나누지 않는다. 한 곳에서만 쓰는 타입, 상수, mock 데이터는 사용하는 파일 안에 둔다.

## 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| Component | PascalCase, 파일명 = 컴포넌트명 `.tsx` | `SeatCard.tsx` |
| Page | PascalCase + `Page` | `FlightSearchPage` |
| Hook | `use` + camelCase, `.ts` | `useSeatSelection` |
| Utility | camelCase 동사 | `formatDate` |
| Constant | UPPER_SNAKE_CASE | `MAX_SEAT_COUNT` |
| 핸들러 | 내부 함수 `handle*`, props `on*` | `handleClick`, `onSelect` |
| boolean | `is` / `has` / `can` | `isSelected` |
| CSS | 스타일링 방식이 확정되면 추가 | — |

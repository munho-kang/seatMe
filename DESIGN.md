# Design Guide

> Figma → React 구현용 디자인 가이드. 새 화면을 만들 때 Figma 전체를 다시 분석하지 않고 이 문서를 먼저 본다.
> 값은 모두 Figma MCP(`get_design_context`)로 확인한 실제 값이다. 확인하지 못한 것은 `확인 필요`로 표시했다.
> 분석 날짜: 2026-09-30

- Figma 파일: `Fviw253VxzJEoLOCxrK7GA` (seatme (복사))
- 페이지: `12:2` "SeatMe · 항공 MVP Wireframe" (페이지 1개)
- 화면 확인이 필요할 때만 아래 표의 node ID로 `get_design_context` / `get_screenshot`를 호출한다.

---

## 1. Design Overview

- 서비스: 항공 좌석 추천 MVP. 사용자의 좌석 취향(Seat Profile)을 저장하고 항공편마다 좌석 TOP 3를 추천한다.
- 플랫폼: **모바일만 있음**. 모든 Frame이 `iPhone 16 & 17 Pro` 402 × 874. Tablet / Desktop 디자인은 없다.
- 구성: 모든 요소가 absolute 좌표로 배치되어 있다(Auto Layout은 일부 컴포넌트에만 있음). 구현할 때는 좌표를 그대로 옮기지 말고 flex/column 레이아웃으로 바꾼다.
- Figma Variables, Styles, Components는 **없다**. 캔버스 왼쪽(x=2916)에 컬러 스와치 사각형 10개가 있고, 이것이 사실상 유일한 팔레트 정의다.
- Shadow는 어디에도 쓰이지 않는다.
- 상태 표현 방식: 같은 화면을 복제해 **기본 → 선택됨 → 누름(pressed)** 순서로 Frame을 나란히 두었다.

---

## 2. Global Design Rules

### Colors

**팔레트 스와치(캔버스에 정의된 10색)**

| 토큰 후보 | HEX | 사용처 |
|---|---|---|
| `color.bg` | `#FBFCFE` | 모든 화면 배경 |
| `color.primary` | `#3357E0` | 로고, Primary 버튼, 선택 상태, 링크, 하단 탭바, 점수 |
| `color.surface` | `#FFFFFF` | 카드, 입력창, 모달 |
| `color.surface-muted` | `#F2F5FA` | 누른 버튼 배경, 척도 칩, 좌석 기본 배경 |
| `color.text-sub` | `#6B7385` | 보조 텍스트, 설명, 선택되지 않은 칩 텍스트 |
| `color.tint-blue` | `#EDF2FF` | 정보 카드, 선택된 카드 배경, Tonal 버튼 |
| `color.tint-green` | `#E5F7ED` | Seat Profile 카드, "추천 이유" 박스 |
| `color.tint-yellow` | `#FCF5E0` | "아쉬운 점" 박스 |
| `color.danger` | `#C4333D` | 로그아웃 (메뉴 텍스트, 모달 버튼) |
| `color.border` | `#DBDFEB` | 입력창, 옵션 카드, Outline 버튼 테두리 |

**스와치에는 없지만 화면에서 반복되는 색**

| 토큰 후보 | 값 | 사용처 |
|---|---|---|
| `color.text` | `#171C29` | 본문 제목, 카드 제목, 라벨 (가장 많이 쓰이는 본문 색) |
| `color.text-strong` | `#000000` | 화면 제목(Auth·Onboarding·Home), 버튼 라벨, 카드 제목 일부 |
| `color.text-caption` | `#989DAB` | 화면 제목 아래 캡션 (비교·상세) |
| `color.text-tradeoff` | `#B59F7A` | 추천 카드의 "아쉬운 점:" 텍스트 |
| `color.border-light` | `#EDEFF5` | 검색 필드 카드, 항공편 카드, 추천 카드, 경로 칩 |
| `color.border-strong` | `#D6DBE8` | 척도 칩, 좌석, 여행 카드, 메뉴, 모달, 정보 신뢰도 박스 |
| `color.progress-inactive` | `#DEE3F0` | 온보딩 진행 바의 비활성 구간 |
| `color.track` | `#E5E8F0` | 우선순위 가중치 바 트랙 |
| `color.seat-recommended` | `#C7D9FC` | 좌석맵에서 선택되지 않은 추천 좌석(2·3위) |
| `color.overlay` | `rgba(217,217,217,0.5)` | 모달 뒤 dim |
| 투명 검정 | `rgba(0,0,0,0.5)` / `0.6` / `0.8` | 입력 placeholder, 보조 링크, 작은 라벨 |
| 투명 텍스트 | `rgba(23,28,41,0.8)` | "최근 경로" 라벨과 칩 텍스트 |

- Success / Warning / Error 상태 색은 따로 정의되어 있지 않다. 틴트 박스(green/yellow)와 `danger`만 있다.
- Disabled 색은 정의되어 있지 않다(→ §9).

### Typography

- Font family: **Pretendard만 사용한다** (Regular 400 / Medium 500 / SemiBold 600 / Bold 700). _(결정 2026-09-30)_
  - Figma에서 Noto Sans KR로 된 텍스트도 **같은 size / weight의 Pretendard**로 구현한다(Noto Bold → Pretendard Bold, Noto Regular → Pretendard Regular).
- Letter spacing: 모두 0.
- Line height: 대부분 `normal`. 버튼·설명·입력은 `100.525%`, 일부 라벨은 `1.2`, 모달 본문은 `1.4`.

| 역할 | Font / Weight | Size | Color | Line height | 사용 예 |
|---|---|---|---|---|---|
| Logo | Pretendard Bold | 24 | primary | normal | 상단 "SeatME" |
| Display | Pretendard Bold | 40 | #000 | normal | "예매 완료" |
| Title A | Pretendard Bold | 24 | #000 | normal | Auth, Onboarding, Home, 항공편 찾기 |
| Title B | Pretendard Bold | 21 | text | normal | 항공편 목록, 여행 설정, 추천, 비교, 좌석맵, 좌석 상세 |
| Title C | Pretendard Bold | 22 | text | normal | 내 여행, Seat Profile, 마이 |
| Modal title | Pretendard Bold | 20 | text | normal | "로그아웃할까요?" |
| Big number | Pretendard Bold | 20 | text / primary | normal | 항공편 시간, 상세 점수 "92점" |
| Card title | Pretendard SemiBold | 16 | #000 | 1.2 | Home 카드 제목, "내 Seat Profile 자동 적용" |
| Rank title | Pretendard Bold | 16 | #000 | 1.2 | "1위 - 12A" |
| Button L | Pretendard SemiBold | 16 | white / primary | 100.525% | 모든 52·48·40px 버튼 |
| Input | Pretendard SemiBold | 14 | rgba(0,0,0,.5) | 100.525% | 입력창 텍스트 |
| Body strong | Pretendard Bold | 13 | text | normal | 옵션 카드, 체크리스트, 여행 카드 제목 |
| Description | Pretendard Regular | 13 | text-sub | 100.525% | 제목 아래 설명 (Auth·Onboarding) |
| Label | Pretendard Bold | 12 | text / #000 | normal·1.2 | 메뉴 라벨, 항공사명, 옵션 제목 |
| Link | Pretendard SemiBold·Bold | 12 | primary | normal | "프로필 수정", "나중에" |
| Caption strong | Pretendard Bold | 10–11 | text | normal | 섹션 라벨("개인화", "다가오는 여행") |
| Caption | Pretendard Regular | 10 | text-sub | normal | 기종·소요시간, 메뉴 값, 화면 설명 |
| Micro | Pretendard Bold / Regular | 9 | text / text-sub | normal | 좌석맵 "▲ FRONT", "날개 영역" |

### Spacing

Spacing 스케일은 정의되어 있지 않다. 반복해서 확인된 값만 적는다.

| 값 | 사용처 |
|---|---|
| **31–32px** | 화면 좌우 여백 (콘텐츠 폭 339 / 화면 402) |
| 96px | 화면 상단 → 화면 제목 top |
| 39px | 화면 상단 → 로고 top |
| 140px / 130px | 설명 텍스트 top (Title A 화면 / Title C 화면) |
| 203px | Title A 화면에서 첫 콘텐츠 블록 top |
| 14px | 카드 좌우 padding (auto-layout 카드: 여행 카드, 메뉴, 정보 박스, 계정 헤더) |
| 12–13px | 카드 상하 padding (auto-layout 카드) |
| 5 / 6px | 카드 내부 세로 gap (정보 박스 5, 여행 카드·척도 카드 6) |
| 8px | 메뉴 행 사이, 모달 버튼 사이 |
| 12px | 모달 내부 gap |
| 5px | 좌석맵 좌석 사이 gap |

absolute 배치 화면에서 확인된 카드 간 세로 간격은 화면마다 다르다(15 / 28 / 31 / 32 / 35px). 구현할 때는 화면별 값을 따른다(→ §5).

### Radius

| 값 | 사용처 |
|---|---|
| **20px** | 버튼, 입력창, 카드, 칩, 척도 버튼, 모달, 탭바 상단 모서리 (기본값) |
| 15px | 좌석 상세의 정보 박스 4종 |
| 8px | 좌석맵 좌석 |
| 4px | 가중치 바 |
| 3px | 온보딩 진행 바 |
| 50% | 소셜 로그인 아이콘(50px), 완료 체크 원(150px) |

### Shadows

없음. Figma 전체에서 shadow가 발견되지 않았다.

### Borders

- 굵기: 1px (기본), **3px** (선택된 카드, 누른 40px 버튼).
- 스타일: solid만 사용.
- 색: `#DBDFEB` / `#EDEFF5` / `#D6DBE8` 세 가지가 비슷한 흰 카드에 섞여 쓰인다(→ §9). 선택 상태는 `#3357E0`.

### Layout

- 기준 Frame: 402 × 874, 배경 `#FBFCFE`.
- 콘텐츠 컬럼: 폭 339, 가로 중앙 정렬(좌우 약 31.5px).
- 상단: 로고 "SeatME"(left 32, top 39) — 온보딩 화면을 뺀 모든 화면. 별도 Header bar는 없다.
- 하단 탭바: 높이 75, 폭 402(full), 화면 하단 고정, 배경 primary, 위쪽 모서리 20px (→ §3 BottomTabBar).
- 하단 CTA: 탭바가 있는 화면은 CTA 중심이 약 y=731(탭바 위), 탭바가 없는 화면은 y=715–763 부근이다. 콘텐츠 흐름과 별개로 **하단에 붙는 CTA 영역**으로 구현한다.
- Grid 시스템 없음. 2열 배치는 항공편 찾기의 날짜/인원(160 + 18 gap + 160)과 경로 칩 3개(100 × 3, space-between)뿐이다.
- 스크롤: 마이 화면만 콘텐츠가 874를 넘는다(`Scroll extent · 마이페이지` 레이어가 y=945에 있음). 나머지 화면은 한 화면 안에 들어간다.

---

## 3. Global Components

여러 기능에서 반복되는 UI만 적는다.

### Button

- Purpose: 화면의 주 행동 / 보조 행동.
- Structure: 가운데 정렬 텍스트 1개. 아이콘 없음.
- Variants

| Variant | 크기 | 배경 | 테두리 | 텍스트 |
|---|---|---|---|---|
| primary | 339×52 (L), 123×48·160×48 (M), 339×40 (S) | primary | 없음 | SemiBold 16 white |
| outline | 339×52 | white | 1px `#DBDFEB` | SemiBold 16 #000 ("이메일로 로그인") |
| tonal | 339×40 | `#EDF2FF` | 없음 | SemiBold 16 primary ("TOP 3 한눈에 비교") |
| danger | 306×48 | `#C4333D` | 없음 | **Bold 13** white (로그아웃 모달) |
| modal-cancel | 306×48 | white | 1px `#D6DBE8` | **Bold 13** text (로그아웃 모달 "취소") |
| text | — | 없음 | 없음 | "이전"·"추천목록": SemiBold 16 #000 / "나중에": Bold 12 primary |

- States (**연한 버튼 = pressed 상태로 확정**, 결정 2026-09-30. `:active`로 구현)
  - pressed (L·M): 배경 `#F2F5FA`, 텍스트 primary. 모든 CTA에서 반복된다.
  - pressed (S, 40px): 배경 `#F2F5FA` + **3px primary 테두리**, 텍스트 primary (2014:875, 2014:910).
  - pressed (outline): 배경 `#F2F5FA`, 텍스트 primary (2014:61).
  - pressed (text link): 흐려짐 (2014:42 하단 링크).
  - hover / focus / disabled: 디자인 없음. 추후 추가 예정이므로 임의로 만들지 않는다.
- Props 후보: `variant`, `size`, `children`, `onClick`, `type`.
- Used In: 모든 기능.
- Design Rules: 폭은 콘텐츠 컬럼 폭(339). radius 20 고정.

### TextField

- Structure: 339×52, white, 1px `#DBDFEB`, radius 20, 텍스트 left padding 21, SemiBold 14 `rgba(0,0,0,0.5)`.
- States: empty(placeholder) / filled. 두 상태의 텍스트 색이 같다. focus / error 디자인 없음.
- 비밀번호는 `*****`로 표시.
- Props 후보: `type`, `placeholder`, `value`, `onChange`.
- Used In: 이메일 로그인, 회원가입.
- 세로 간격: 로그인 15px(203→270), 회원가입 28px(203→283).

### SelectableCard (선택형 카드)

선택 상태를 "배경 틴트 + 3px 테두리"로 표현하는 카드. 내용은 화면마다 다르다.

- 기본: white, 1px `#EDEFF5`, radius 20.
- 선택: `#EDF2FF` 배경, **3px `#3357E0`** 테두리.
- Used In: 항공편 목록(180h), 이번 여행 설정(80h), 추천 좌석(150h).
- Props 후보: `isSelected`, `onSelect`, `children`.
- 구현: 테두리가 1→3px로 바뀔 때 레이아웃이 밀리지 않도록 처리한다(예: 기본 상태도 3px 투명 테두리 + inset, 또는 `outline`).

### OptionButton (단일 선택 버튼, 온보딩 질문 1)

- 339×52, radius 20, 텍스트 Bold 13, left padding 16.
- 기본: white + 1px `#DBDFEB`, 텍스트 text.
- 선택: primary 배경(테두리 없음), 텍스트 white.
- SelectableCard와 선택 표현이 다르다(채움 vs 틴트+테두리). 별도 컴포넌트로 둔다.

### ScaleSelector (1–5 척도)

- 구조: 제목 + 칩 5개(1–5). 카드 안에 들어간다.
- Figma에서는 온보딩과 Seat Profile 편집의 칩이 달랐다. **아래 통일 스펙 하나로 구현한다** _(결정 2026-09-30, 통일안은 Claude가 정함)_.

| 항목 | 통일 스펙 | 근거 |
|---|---|---|
| 칩 크기 | 52 × 34 | 온보딩 값. 편집 화면(32)보다 터치 영역이 넓다 |
| 칩 radius | 20 | 두 화면 같음 |
| 텍스트 | Pretendard Bold 11 | Pretendard 기본 결정 + 온보딩 크기(편집 화면 10은 너무 작음) |
| 기본 | 배경 `#F2F5FA`, 1px `#D6DBE8`, 텍스트 `#6B7385` | 두 화면 같음 |
| 선택 | 배경 primary, **1px primary 테두리**, 텍스트 white | 편집 화면 값. 파란 칩에 회색 테두리가 보이지 않게 |
| 칩 줄 배치 | `justify-between`, 카드 안 좌우 padding 12 | 편집 화면 값(auto-layout). 온보딩 10/11 비대칭 대신 |
| 카드 | 화면별 값 유지 (온보딩 339×92 / 편집 padding 10·12, gap 6) | 카드 레이아웃은 통일 대상이 아님 |

- Used In: 온보딩 민감도(2014:186 계열), Seat Profile 편집(2014:1478 계열).
- Props 후보: `label`, `value`, `onChange`.

### Card / InfoBox (틴트 박스)

| 이름 | 배경 | 테두리 | radius | 사용처 |
|---|---|---|---|---|
| tint-blue 카드 | `#EDF2FF` | 없음 | 20 | Home "어디로 떠나세요?", 다가오는 여행, Seat Profile 자동 적용, 로그인 체크리스트, 계정 헤더 |
| tint-green 카드 | `#E5F7ED` | 없음 | 20 | Home "내 Seat Profile", 로그인 "저장된 Seat Profile 예시", 창가/통로 행 |
| white 카드 | white | 1px (색 3종) | 20 | 최근 검색, 온보딩 인트로, 우선순위, 여행 카드 |
| InfoBox (15) | green / yellow / white / blue | white만 1px `#D6DBE8` | **15** | 좌석 상세 4종 |

- InfoBox 구조: 제목(Bold 11 text) + 본문 줄들(Regular 10 text-sub), padding 12/14, gap 5.

### MenuRow

- 339×54, white, 1px `#D6DBE8`, radius 20, padding-x 14, `justify-between`.
- 왼쪽 라벨 Bold 12 text / 오른쪽 값 Regular 10 text-sub ("3개", "ON", "v1.0.0", ">").
- danger 변형: 라벨·값 모두 `#C4333D` ("로그아웃").
- 행 사이 gap 8.
- Used In: 마이.

### BottomTabBar

- 402×75, primary, 위쪽 모서리 20, 화면 하단 고정.
- 아이콘 3개(24px, white, 아이콘 top 26): 왼쪽 비행기(custom vector, left ≈ 67), 가운데 홈(`akar-icons:home-alt1`), 오른쪽 사람(`akar-icons:person`, left 315).
- 라벨 없음. 활성 탭 표시 없음(→ §9).
- Used In: Main, Recommendation, Booking, MyPage 기능 전체. Auth·Onboarding에는 없다.

### ProgressStepper (온보딩)

- 3구간, 높이 6, radius 3, 구간 사이 gap 6. top 55, left 32.
- 활성 구간: 폭 54, primary. 비활성 구간: 폭 24, `#DEE3F0`.
- 현재 단계의 구간만 길어진다(1단계: [54][24][24], 2단계: [24][54][24], 3단계: [24][24][54]).

### Modal (Confirm)

- dim: 화면 전체 `rgba(217,217,217,0.5)` (탭바 위까지 덮음).
- 카드: 339 폭, white, 1px `#D6DBE8`, radius 20, padding 20/18/18/18, gap 12, 화면 세로 중앙.
- 구조: 제목(Bold 20) → 본문(Regular 11, lh 1.4, text-sub) → 버튼 column(gap 8, danger + modal-cancel).
- Used In: 로그아웃 확인(2014:1673)만 있다.

### Logo

- "SeatME" 텍스트, Pretendard Bold 24 primary. 이미지 로고 없음.
- 탭바가 있는 화면과 Auth 화면 모두 좌상단(32, 39)에 있다.

---

## 4. Design Patterns

| Pattern | 구조 | 사용 화면 |
|---|---|---|
| Page Header | 로고 → 제목(top 96) → 설명/캡션(top 130–140) | 거의 모든 화면 |
| Step Header | 진행 바(top 55) → 질문 제목 → 설명 | 온보딩 질문 3단계 |
| Bottom CTA | 하단 339×52 Primary 1개 | 로그인 랜딩, 온보딩 인트로·우선순위, 항공편 찾기, 여행 설정, 좌석맵, 좌석 상세, 예매 완료, Seat Profile |
| Prev / Next | 왼쪽 텍스트 버튼 "이전" + 오른쪽 123×48 Primary "다음" | 온보딩 질문 1·2, 비교("추천목록" / "좌석맵에서 보기" 160×48) |
| Stacked CTA | 339×40 Primary + 339×40 Tonal | 추천 좌석 |
| Single-select list | OptionButton / SelectableCard를 세로로 나열, 선택 뒤 CTA가 나타나거나 활성화 | 온보딩 질문 1, 항공편 목록, 여행 설정, 추천 좌석 |
| Scale form | 카드 안 제목 + 1–5 칩 | 온보딩 민감도, Seat Profile 편집 |
| Summary card | 틴트 카드 + 제목 + 요약 한 줄 + 링크 | Home, 항공편 찾기 |
| Form | TextField 세로 나열 → Primary → 보조 링크 | 이메일 로그인, 회원가입 |
| Settings list | 섹션 라벨 + MenuRow 묶음 | 마이 |
| Result / Success | 원형 아이콘 + Display 텍스트 + 하단 CTA | 예매 완료 |

Empty / Error / Loading 패턴은 Figma에 없다. 추후 디자인이 추가될 예정이므로 임의로 만들지 않는다.

---

## 5. Feature Design

Global Rule과 같은 내용은 다시 적지 않는다. 화면 ID는 §6 Page Map 참조.

### 5.1 Auth (로그인 / 회원가입)

- Purpose: 네이버 또는 이메일 로그인, 회원가입, 로그인 없이 둘러보기.
- Screen Structure
  - 로그인 랜딩: 로고 → 제목 → 설명 → tint-blue 체크리스트 카드(339×131) → tint-green 예시 카드(339×131) → 하단 Primary "네이버로 계속하기" + Outline "이메일로 로그인" → 하단 링크 "처음이라면 회원가입 · 로그인 없이 둘러보기"(Bold 12 primary).
  - 이메일 로그인: TextField 2개 → Primary "로그인" → "비밀번호를 잊으셨나요?"(SemiBold 14 `rgba(0,0,0,.6)`) → "또는" 구분선(1px 선 + 가운데 텍스트) → 소셜 아이콘 3개(카카오·애플·네이버, 50px 원, 간격 92) → 하단 "SeatMe가 처음이신가요? 회원가입".
  - 회원가입: TextField 4개(이메일 / 비밀번호(최소 6자리) / 비밀번호 재확인 / 닉네임) → Primary "회원가입" → "로그인 없이 둘러보기".
  - 네이버 동의 화면(2014:557): **구현 대상** _(결정 2026-09-30: 최대한 비슷하게 구현)_. 아래 §5.1.1 참조.
- Typography: 체크리스트·예시 카드 텍스트 Bold 13 text, 줄 간격 33px.
- States: 2014:23(네이버 pressed), 2014:42(하단 링크 pressed: 흐려짐), 2014:61(이메일 버튼 pressed), 2014:498(입력 완료 + 로그인 pressed), 2014:539(입력 완료 + 회원가입 pressed).
- Implementation Notes: 소셜 아이콘은 이미지 asset(PNG)이다. 이메일 로그인 제목 레이어가 두 개 겹쳐 있다(같은 텍스트, 무시).

#### 5.1.1 네이버 동의 화면 (2014:557)

Figma에서는 네이버 동의 화면 **캡처 이미지 한 장**(node 2014:558, 원본 1760×1580)을 Frame에 487×438로 배치하고 위에 SeatME 로고를 덧씌운 것이다. 구조화된 레이어가 없으므로 아래 값은 **이미지에서 측정한 추정치**다(원본 px × 0.277 = Frame px). 이 화면은 SeatMe 디자인 시스템이 아니라 네이버 화면 스타일을 따르므로 Global 토큰을 쓰지 않고 화면 전용 값으로 둔다.

- 화면: 배경 `#F8F8F8`, 로고·탭바 없음. 카드가 화면 세로 중앙보다 약간 아래(top ≈ 244).
- 카드: white, 1px `#C9C9C9`, radius ≈ 12, 폭 ≈ 356(left ≈ 23), 높이 ≈ 393. 내부 좌우 padding ≈ 21.
- 위에서부터
  1. 헤더 행: 왼쪽 네이버 "N" 로고(`#03C75A`) + "네이버 로그인"(Bold) / 오른쪽 회색 원 아바타(`#E5E5E5`) + "Naver ID" + ▼.
  2. 서비스 영역: 이미지에는 검은 앱 아이콘 + "서비스명"이 있으나 Figma가 흰 박스(2014:560, 123×44)로 가리고 **"SeatME"(Pretendard Bold 24 primary, left 43 / top 308)**를 올렸다 → 아이콘 없이 SeatME 로고 텍스트로 구현.
  3. "전체 동의하기"(Bold) + "선택 동의 포함"(회색) — 왼쪽에 원형 체크.
  4. 카드 폭 전체 구분선 `#EBEBEB`.
  5. "네이버 개인정보 처리 동의"(Bold) 제목.
  6. [필수] 개인정보 제 3자 제공 동의 — **체크된 상태**(초록 `#03A94D` 원 + 흰 체크), 아래 설명 "이용자 식별자, 이름, 이메일 주소"(회색), 오른쪽 `>`.
  7. [선택] 개인정보 제 3자 제공 동의 — 체크 안 됨(회색 테두리 원 + 회색 체크), 오른쪽 `>`, 아래 하위 항목 2개 가로 배치 "성별" / "생일"(각각 원형 체크).
  8. 안쪽 구분선 `#EBEBEB`(좌우 padding 안쪽).
  9. 안내문 3줄(회색, 작은 글씨): "네이버는 회원가입/로그인 기능 제공자이며, {서비스명} 서비스 제공자가 아닙니다. …"
  10. 버튼 2개 가로 배치(각 ≈ 159×34, gap ≈ 9, radius ≈ 6): "취소"(배경 `#F5F5F5`, 텍스트 `#2E2E2E`) / "동의하기"(배경 `#03A94D`, 텍스트 white).
- 크기 참고(Frame px 추정): 헤더 제목 ≈ 14, SeatME 24, "전체 동의하기" ≈ 12, 항목 ≈ 10–11, 안내문 ≈ 9, 버튼 ≈ 11.
- 원형 체크 상태: 체크됨(초록 채움 + 흰 체크) / 안 됨(회색 테두리 + 회색 체크). "전체 동의하기"는 모든 항목을 함께 토글하는 것으로 보인다(문구 기준).
- Figma의 초록 사각형(2014:559, `#03A94D`, 34×21, left 305 / top 596)은 "동의하기" 버튼 위의 링크 hotspot이다. 보이는 요소가 아니다.
- 폰트: 이미지 폰트는 Pretendard와 비슷한 고딕이다. Pretendard 기본 결정에 따라 Pretendard로 구현한다.

### 5.2 Onboarding (Seat Profile 만들기)

- Purpose: 첫 Seat Profile 생성. 인트로 → 질문 3단계 → 추천 시작.
- Screen Structure
  - 인트로: 상단 "Seat Profile 만들기"(Bold 12 #000) + 우측 "나중에"(Bold 12 primary) → 제목 → 설명 → white 카드(339×176, 1px `#DBDFEB`)에 단계 1–3 목록(Bold 13) + "모든 질문은 5지선다로 빠르게 선택"(Medium 12 primary) → 하단 Primary "내 취향 설정 시작" → 캡션 "설정은 언제든 마이페이지에서…"(Bold 12 text-sub).
  - Q1 창가/통로: OptionButton 5개(top 203부터 87 간격) → Prev/Next.
  - Q2 민감도: ScaleSelector 카드 5개(339×92, 107 간격): 햇빛 / 주변 소음·통행 / 흔들림·멀미 걱정 / 빠른 하차 / 전망 → Prev/Next.
  - Q3 우선순위: 순위 카드 5개(339×75, 107 간격). 각 카드에 "N위 - 항목" + 가중치 바 → 하단 Primary "이 조건으로 추천받기" → "이전"(Bold 12 text-sub, 가운데).
- Design Characteristics
  - **로고 없음**. 인트로는 텍스트 헤더, 질문은 ProgressStepper.
  - 척도 칩: §3 ScaleSelector 통일 스펙을 따른다.
  - 가중치 바: 트랙 300×7 `#E5E8F0` radius 4, 채움 `#3361E0`. 채움 폭 1위 300(트랙 없음) / 2·3위 198.4 / 4위 99.2 / 5위 49.6.
- States: 선택 안 함 → 선택 → "다음" pressed. Q1은 선택하지 않았을 때도 "다음"이 primary로 보인다(→ §9).
- Responsive: 없음(모바일만).

### 5.3 Home

- Purpose: 로그인 후 첫 화면. 검색 진입, 프로필 요약, 최근 검색, 다가오는 여행.
- Screen Structure: 로고 → "안녕하세요, 시트밍님"(Title A) → 카드 4개
  1. tint-blue 339×131: "어디로 떠나세요?"(SemiBold 16) + 설명(Regular 11 text-sub) + 우하단 링크 "항공편 찾기 >"(Bold 16 primary)
  2. tint-green 339×131: "내 Seat Profile" + 요약 한 줄(Bold 12) + "프로필 수정"(SemiBold 12 primary)
  3. white + 1px `#DBDFEB` 339×131: "최근 검색"(SemiBold 13) + 경로(Bold 13) + "같은 취향으로 다시 찾기"(SemiBold 12 primary)
  4. tint-blue 339×75: "다가오는 여행"(SemiBold 13 `rgba(0,0,0,.8)`) + 요약(Bold 15)
- 카드 간격 31px. 카드 안 텍스트 left padding 약 21–25.
- States: 1개 상태만 있음.

### 5.4 Flight Search (항공편 찾기 → 목록 → 여행 설정)

- 항공편 찾기(2014:590)
  - 필드 카드: 출발 / 도착 339×75, 날짜 / 인원 160×75 2열. white + 1px `#EDEFF5`. 라벨 SemiBold 10 `rgba(0,0,0,.5)`(top +13), 값 Bold 14 text(top +38), left padding 25.
  - "최근 경로"(Bold 14 `rgba(23,28,41,.8)`) + 경로 칩 3개(100×36, white, 1px `#EDEFF5`, 텍스트 Bold 10).
  - tint-blue 카드 "내 Seat Profile 자동 적용" + 요약 + "이번 여행만 바꾸기".
  - 하단 Primary "항공편 검색". 2014:630 = pressed.
  - 출발지·날짜·인원 선택 UI(picker, 달력)는 **디자인 없음**.
- 항공편 목록(2014:670 / 699)
  - 제목: 경로 "김포 → 제주"(Title B).
  - SelectableCard 339×180, 간격 28: 항공사+편명(Bold 12 #000) / 우상단 "SeatMe 추천 가능"(Regular 10 primary) / 시간(Bold 20 text) / 기종·소요시간(Regular 10 text-sub).
  - 목록 화면에는 CTA가 없다. 선택 뒤 이동 방식은 → §9.
- 이번 여행 설정(2014:728 / 753 / 780)
  - SelectableCard 339×80 세 개, 간격 28: "평소처럼 그대로 사용" / "이번 여행만 조금 바꾸기" / "처음부터 다시 설정". 제목 Bold 12 #000, 설명 Regular 10 text-sub, left padding 16.
  - 선택 전에는 CTA 없음 → 선택하면 하단 Primary "바로 좌석 추천받기"가 나타남 → pressed.

### 5.5 Recommendation (추천 → 비교 → 좌석맵 → 상세)

- 추천 좌석(2014:807 / 839 / 875 / 910)
  - 제목 "시트밍님에게 잘 맞는 좌석"(Title B) + 캡션 "평소 취향 + 이번 여행 '풍경 보기' 반영"(Bold 10 **primary**).
  - SelectableCard 339×150 세 개, 간격 28: "N위 - 좌석"(Bold 16 #000) + 우측 점수(Bold 14 primary) + 특징(SemiBold 14 text-sub) + "아쉬운 점: …"(SemiBold 12 `#B59F7A`). padding-left 25.
  - 선택 전 CTA 없음 → 선택 뒤 Stacked CTA("선택 완료" Primary S + "TOP 3 한눈에 비교" Tonal S).
  - 1위 카드가 선택된 상태가 기본으로 보인다(2014:839).
- TOP 3 비교(2014:946 / 1021)
  - 캡션 색이 `#989DAB`(추천 화면 캡션은 primary).
  - 비교표: white 340×316 radius 20, **테두리 없음**. 행 7개(좌석 / 적합도 / 햇빛 / 전망 / 조용함 / 빠른 하차 / 아쉬운 점), 행 높이 38 · 간격 44. 라벨 열 98폭 Bold 14 text, 값 열 76폭 × 3 Regular 12.
  - 첫 번째 좌석 열 값은 primary, 나머지는 text-sub. 단 "빠른 하차"·"아쉬운 점" 행은 첫 열도 text-sub.
  - 하단 Prev/Next 변형: "추천목록"(텍스트) + "좌석맵에서 보기"(Primary 160×48).
- 좌석맵(2014:1096 / 1220)
  - 제목 "B737-8 좌석맵"(Title B).
  - 좌석맵 컨테이너: white 340×355 radius 20. 위 "▲ FRONT / 출입문"(Bold 9), 아래 "날개 영역 11–14열"(Regular 9 text-sub).
  - 행: 좌석 번호(24×24, Bold 10) + A B C + 통로 12px + D E F, gap 5. 9–15열만 표시.
  - 좌석 39×30, radius 8, Bold 10. 상태: 기본(`#F2F5FA` + `#D6DBE8` 테두리) / 선택 추천 1위(primary 채움, 흰 글자) / 다른 추천(`#C7D9FC` 채움).
  - 하단 Primary "12A 자세히 보기".
- 좌석 상세(2014:1344 / 1377)
  - 제목: 좌석 번호 "12A"(Title B) + 우상단 점수 "92점"(Bold 20 primary, top 77).
  - 캡션(Bold 10 `#989DAB`).
  - InfoBox 4개(342폭, radius 15, 간격 약 12): 추천 이유(green) / 아쉬운 점(yellow) / 정보 신뢰도(white + 테두리) / 예매 전에(blue).
  - 하단 Primary "예매하기".

### 5.6 Booking Complete

- 2014:1410 / 1428. 원형 체크(150px primary + 흰 체크 벡터, 가운데) → "예매 완료"(Bold 40) → 하단 버튼 "홈으로".
- 2014:1410은 버튼이 primary이고 텍스트에 오타("횸으로")가 있다. 2014:1428은 pressed 스타일이고 "홈으로"로 수정되어 있다.
- 체크 원과 체크는 SVG asset(원: node 2014:1440, 체크: 2014:1441).

### 5.7 My Page (내 여행 / 마이 / Seat Profile 편집)

- 내 여행(2014:1446)
  - 제목 "내 여행"(Title C) + 설명(Regular 10 text-sub).
  - 섹션 라벨(Bold 11 text): "다가오는 여행", "지난 여행".
  - 여행 카드: 339폭, radius 20, auto-layout(padding 13/14, gap 6). 다가오는 여행 = `#EDF2FF` + 1px `#D6DBE8`, 지난 여행 = white + 1px `#D6DBE8`.
    - 경로·항공사(Bold 13) / 날짜(Regular 10 text-sub) / 추천 좌석·점수(Bold 11) / 링크(Bold 10 primary).
  - 하단 가운데 링크 "최근 노선으로 새 여행 만들기 →"(Bold 11 primary).
- 마이(2014:1626 / 1673)
  - 계정 헤더: `#EDF2FF` 334×88 radius 20. 이름(Bold 14) + 로그인 방식(Regular 10 text-sub) + 우측 "계정 관리"(Bold 10 primary).
  - 섹션 라벨 Bold 10 text("개인화", "서비스") + MenuRow.
  - 개인화: Seat Profile 관리 / 최근 검색 기록 / 알림 설정. 서비스: 공지사항 / 문의하기 / 약관 및 개인정보 / 앱 버전 / 로그아웃(danger).
  - 목록이 탭바 아래까지 이어진다 → 스크롤 필요.
  - 2014:1673 = 로그아웃 확인 Modal.
- Seat Profile 편집(2014:1478 / 1552)
  - 우상단 "초기화"(SemiBold 15 primary, 로고와 같은 줄).
  - 창가/통로 행: `#E5F7ED` 339×52 radius 20, `justify-between`, 라벨 Bold 11 text / 값 Bold 11 primary.
  - ScaleSelector 카드 4개(white + 1px `#D6DBE8`, padding 10/12, gap 6): 직사광선·눈부심 / 주변 소음·통행 / 흔들림·멀미 걱정 / 빠른 하차.
    - 칩: §3 ScaleSelector 통일 스펙을 따른다.
  - 링크 "화장실 접근 · 레그룸 · 충전 등 세부 조건 더보기"(Bold 10 primary) — 펼친 상태 디자인 없음.
  - 하단 Primary "변경사항 저장" → 2014:1552 pressed.

---

## 6. Page Map

| Feature | 화면 | Node ID (상태 변형) | 목적 | 연결 화면 (추정은 `?`) | 공통 Component |
|---|---|---|---|---|---|
| Auth | 로그인 랜딩 | 2014:4 (23, 42, 61) | 로그인 방식 선택 | 네이버 동의, 이메일 로그인, 회원가입, 둘러보기? | Button, Card |
| Auth | 네이버 동의 | 2014:557 | 네이버 동의 화면 재현 (§5.1.1) | 온보딩? | 화면 전용 |
| Auth | 이메일 로그인 | 2014:475 (498) | 이메일 로그인 | 회원가입, Home? | TextField, Button |
| Auth | 회원가입 | 2014:521 (539) | 계정 생성 | 온보딩? | TextField, Button |
| Onboarding | 인트로 | 2014:87 (102) | 프로필 생성 안내 | Q1, 나중에→Home? | Card, Button |
| Onboarding | Q1 창가/통로 | 2014:117 (140, 163) | 좌석 위치 선호 | Q2 | ProgressStepper, OptionButton |
| Onboarding | Q2 민감도 | 2014:186 (260, 334) | 1–5 민감도 | Q3 | ProgressStepper, ScaleSelector |
| Onboarding | Q3 우선순위 | 2014:409 (442) | 우선순위 확인 | 추천? Home? | ProgressStepper, Card |
| Main | 홈 | 2014:562 | 대시보드 | 항공편 찾기, Seat Profile, 내 여행? | Card, BottomTabBar |
| Search | 항공편 찾기 | 2014:590 (630) | 검색 조건 입력 | 항공편 목록 | Card, Button, BottomTabBar |
| Search | 항공편 목록 | 2014:670 (699) | 항공편 선택 | 이번 여행 설정 | SelectableCard, BottomTabBar |
| Search | 이번 여행 설정 | 2014:728 (753, 780) | 프로필 적용 방식 선택 | 추천 좌석 | SelectableCard, Button |
| Recommend | 추천 좌석 | 2014:807 (839, 875, 910) | TOP 3 추천 | 비교, 좌석 상세? | SelectableCard, Button |
| Recommend | TOP 3 비교 | 2014:946 (1021) | 비교표 | 추천 좌석, 좌석맵 | Button |
| Recommend | 좌석맵 | 2014:1096 (1220) | 좌석 위치 확인 | 좌석 상세 | Button |
| Recommend | 좌석 상세 | 2014:1344 (1377) | 추천 근거·예매 | 예매 완료 | InfoBox, Button |
| Booking | 예매 완료 | 2014:1410 (1428) | 완료 안내 | 홈 | Button |
| MyPage | 내 여행 | 2014:1446 | 여행 기록 | 재검색? | Card |
| MyPage | 마이 | 2014:1626 (1673) | 설정 메뉴 | Seat Profile 편집, 로그아웃 | MenuRow, Modal |
| MyPage | Seat Profile 편집 | 2014:1478 (1552) | 취향 수정 | 마이? | ScaleSelector, Button |

- 캔버스 배치: 1행 = Auth(로그인·이메일), 2행 = Auth(로그인 복제·회원가입) + Onboarding, 3행 = 로그인 복제·네이버 동의, 4행 = Home → 검색 → 추천, 5행 = MyPage → 비교 → 예매 완료.
- 화면 간 연결(Prototype flow)은 Figma에서 확인되지 않았다. 위 연결은 버튼 문구로 추정한 것이다.

---

## 7. Responsive Rules

- Figma에는 **모바일(402 × 874) 디자인만** 있다. Breakpoint, Tablet, Desktop 레이아웃이 없다.
- 확인된 규칙: 없음. 컬럼 변화, 네비게이션 변화, 폰트 크기 변화 모두 확인할 수 없다.
- 결정 (2026-09-30): 402보다 넓은 화면에서는 **폭을 그대로 늘린다**(좌우 여백 31.5px 유지, 최대 폭 없음). breakpoint는 만들지 않는다.
- 확인 필요:
  - 402보다 좁은 기기(360 등)에서 339 고정 폭 요소(카드, 척도 칩 5개, 좌석맵 318폭)를 어떻게 줄일지.
  - 기기 높이가 874가 아닐 때 하단 CTA와 탭바의 위치.

---

## 8. Component Map

| 분류 | Component | 사용 기능 |
|---|---|---|
| Global | Button (primary / outline / tonal / danger / text) | 전체 |
| Global | Card (tint-blue / tint-green / white) | Auth, Onboarding, Home, Search, MyPage |
| Global | SelectableCard | Search, Recommend |
| Global | BottomTabBar | Main 이후 전체 |
| Global | Logo | Onboarding 제외 전체 |
| Global | ScaleSelector | Onboarding, MyPage |
| Global | Modal (Confirm) | MyPage (현재 1곳이지만 공통 UI 성격) |
| Feature | TextField | Auth |
| Feature | OptionButton | Onboarding |
| Feature | ProgressStepper | Onboarding |
| Feature | PriorityBar (가중치 바) | Onboarding |
| Feature | InfoBox (radius 15) | Recommend(좌석 상세) |
| Feature | TripCard | MyPage(내 여행) — Home "다가오는 여행"과 구조가 다름 |
| Feature | MenuRow | MyPage |
| Page | CompareTable | TOP 3 비교 |
| Page | SeatMap (+ Seat) | 좌석맵 |
| Page | SearchField (라벨+값 카드) | 항공편 찾기 |
| Page | NaverConsent (동의 카드, 원형 체크) | 네이버 동의 — SeatMe 토큰 대신 화면 전용 값 |
| Inline | "또는" 구분선, 소셜 아이콘 줄 | 이메일 로그인 |
| Inline | 완료 체크 원 | 예매 완료 |
| Inline | 경로 칩 3개 | 항공편 찾기 |
| Inline | 계정 헤더 | 마이 |

---

## 9. Design Inconsistencies / Questions

디자인을 임의로 통일하지 않는다. "확인 필요" 항목은 구현 전에 사용자에게 확인한다.

### 결정된 항목 (2026-09-30)

| # | 항목 | 결정 | 반영 위치 |
|---|---|---|---|
| 2 | Pretendard / Noto Sans KR 혼용 | **Pretendard만 사용**. Noto 텍스트는 같은 size·weight의 Pretendard로 | §2 Typography |
| 6 | ScaleSelector 칩 불일치 | **통일 스펙 하나로 구현** (52×34, Pretendard Bold 11, 선택 테두리 primary, `justify-between` + padding 12) | §3 ScaleSelector |
| 12 | 연한 버튼(`#F2F5FA`)의 의미 | **pressed 상태** (누르면 연해짐) | §3 Button |
| 14–17, 22, 24 | Disabled·focus·error·hover, Empty/Error/Loading, 뒤로 가기 UI, 선택 UI(날짜·인원 등) | **디자인 추후 추가 예정**. 그 전까지 임의로 만들지 않는다 | — |
| 23 | 네이버 동의 화면(2014:557) | **최대한 비슷하게 구현** | §5.1.1 |
| 25 | 추천 목록(10A/15A)과 비교표·좌석맵(11A/14A)의 좌석 차이 | **다른 게 맞음**. 화면별 데이터를 그대로 따른다 | — |
| 18 | BottomTabBar 비행기 아이콘 목적지 | **내 여행**. 내 여행 화면 구현 전까지는 동작 없음 | §3 BottomTabBar |
| 19 | 항공편 목록 카드 선택 뒤 이동 | **카드를 누르면 바로 이번 여행 설정으로 이동**. 뒤로 오면 선택 상태 표시 | §5.4 |

### 남은 확인 필요 — 값 불일치

1. 확인 필요: 화면 제목 **크기·색**이 세 가지다 — Bold 24 #000(Auth·Onboarding·Home·항공편 찾기) / Bold 21 `#171C29`(목록·추천·비교·좌석맵·상세) / Bold 22 `#171C29`(내 여행·Seat Profile·마이). 폰트는 Pretendard로 결정됨. 결정 전까지 화면별 Figma 값을 따른다.
2. 참고: 폰트는 결정됐지만 같은 컴포넌트 안의 **크기** 차이는 남아 있다. 예) 온보딩 민감도 첫 카드 제목 13, 나머지 12 / 우선순위 1위 13, 2–5위 12.
3. 확인 필요: 비슷한 흰 카드의 테두리 색이 `#DBDFEB` / `#EDEFF5` / `#D6DBE8` 세 가지다.
4. 확인 필요: 가중치 바 채움색 `#3361E0`이 primary `#3357E0`과 거의 같지만 다르다.
5. 확인 필요: 제목·본문 검정이 `#000000`과 `#171C29`로 섞여 있다.
7. 확인 필요: "이전" 버튼이 온보딩 Q1·Q2에서는 SemiBold 16 #000 왼쪽 정렬, Q3에서는 Bold 12 text-sub 가운데 정렬이다.
8. 확인 필요: 모달 버튼은 Bold 13, 다른 버튼은 SemiBold 16이다.
9. 확인 필요: 카드 left가 27 / 29 / 30 / 31 / 32, 폭이 334 / 339 / 340 / 341 / 342로 1–5px씩 다르다. 339 가운데 정렬로 맞춰도 되는지.
10. 확인 필요: 카드 사이 세로 간격이 화면마다 15 / 28 / 31 / 32 / 35px로 다르다.
11. 확인 필요: 화면 캡션 색이 추천 화면은 primary, 비교·상세는 `#989DAB`다.

### 남은 확인 필요 — 상태

13. 확인 필요: 40px 버튼의 pressed는 3px 테두리가 추가되고 52px 버튼은 추가되지 않는다. 의도된 차이인지. 결정 전까지 Figma 값을 따른다.

### 남은 확인 필요 — 네비게이션 / 흐름

20. 확인 필요: 추천 좌석 "선택 완료" 뒤 이동할 화면(좌석 상세? 좌석맵?).
21. 확인 필요: 내 여행 화면에 들어가는 경로.

### 남은 확인 필요 — 콘텐츠

26. 확인 필요: 온보딩 민감도는 5항목(전망 포함), Seat Profile 편집은 4항목(전망 없음)이고 항목명도 "햇빛" vs "직사광선·눈부심"으로 다르다.
29. 확인 필요: 네이버 동의 화면 안내문에 템플릿 문구 "{서비스명}"이 그대로 있다. "SeatMe"로 바꿀지.
27. 참고: 2014:1410 "횸으로"는 오타. 2014:1428에서 "홈으로"로 수정되어 있다.
28. 참고: 2014:1673 마이 화면에 "마이" 텍스트 레이어가 하나 더(top 179) 계정 헤더 뒤에 숨어 있다. 구현하지 않는다.

---

## 10. React Implementation Notes

- **absolute 좌표 금지**: Figma 코드는 모든 요소를 absolute로 준다. 세로 흐름은 flex column + gap, 하단 CTA와 탭바만 고정 배치로 구현한다.
- **하단 고정 영역**: 탭바(75px)와 CTA가 겹치지 않게 콘텐츠 영역 아래에 padding을 둔다. 마이 화면처럼 스크롤이 생기는 화면에서 마지막 행이 탭바에 가리지 않게 한다. iOS safe-area는 디자인에 없음 → 확인 필요.
- **긴 텍스트**: 거의 모든 텍스트가 `whitespace-nowrap`이다. 사용자 이름("시트밍님"), 항공사명, 경로, 추천 이유, 메뉴 값이 길어질 때 줄바꿈 / 말줄임 규칙이 없다 → 확인 필요. 특히 "안녕하세요, {이름}님", "{이름}님에게 잘 맞는 좌석"은 339폭을 넘을 수 있다.
- **고정 높이 카드**: Home 카드(131), 항공편 카드(180), 추천 카드(150), 여행 설정 카드(80)가 고정 높이다. 내용이 길면 넘친다. 구현은 `min-height`로 두는 것을 권장하되 디자인 확인 필요.
- **선택 테두리 1→3px**: 레이아웃 흔들림 방지 처리가 필요하다(§3 SelectableCard).
- **선택/누름 상태**: pressed 스타일은 `:active`로 구현할 수 있다. 선택 상태는 컴포넌트 state(`isSelected`)로 관리한다.
- **척도 칩 5개 / 좌석 6열**: 402 미만 폭에서 칩(5×52 + gap)과 좌석 행(318)이 넘칠 수 있다.
- **좌석맵**: 행 번호·좌석이 데이터로 바뀌는 구조다. 좌석 상태 3가지(기본 / 선택 추천 / 다른 추천)를 prop으로 받는다. 9–15열만 디자인되어 있어 더 많은 열의 스크롤 여부는 확인 필요.
- **비교표**: 값 열 폭 76 × 3이 고정이다. "화장실 거리" 같은 긴 값이 12px에서 76폭을 거의 채운다.
- **Modal**: dim이 탭바까지 덮는다. 포커스 트랩·ESC 닫기는 디자인에 없지만 웹 접근성상 필요하다 → 확인 필요.
- **아이콘·이미지 asset** (Figma asset URL은 7일 뒤 만료되므로 구현할 때 다시 받아서 assets 폴더에 한 번만 저장):
  - 탭바: `akar-icons:home-alt1`, `akar-icons:person`(24px), 비행기 vector
  - 소셜 로그인: 카카오 / 애플 / 네이버 원형 PNG 50px (node 2014:495–497)
  - 예매 완료: 원 SVG(2014:1440) + 체크 SVG(2014:1441)
  - "✓", "→", ">", "▲"는 이미지가 아니라 **텍스트 문자**다.
- **폰트**: Pretendard만 로드한다. Noto Sans KR은 쓰지 않는다.

---

## 11. Design Tokens

실제로 반복 확인된 값만 적었다. 이름은 후보이며 스타일링 방식이 정해진 뒤 확정한다.

```
color.primary            #3357E0
color.bg                 #FBFCFE
color.surface            #FFFFFF
color.surface-muted      #F2F5FA
color.tint-blue          #EDF2FF
color.tint-green         #E5F7ED
color.tint-yellow        #FCF5E0
color.danger             #C4333D
color.text               #171C29
color.text-strong        #000000
color.text-sub           #6B7385
color.text-caption       #989DAB
color.text-tradeoff      #B59F7A
color.border             #DBDFEB
color.border-light       #EDEFF5
color.border-strong      #D6DBE8
color.progress-inactive  #DEE3F0
color.track              #E5E8F0
color.seat-recommended   #C7D9FC
color.overlay            rgba(217,217,217,0.5)

font.family.base         Pretendard            (유일한 폰트)
font.size                9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 20 / 21 / 22 / 24 / 40
font.weight              400 / 500 / 600 / 700
line-height.normal       normal
line-height.tight        100.525%              (버튼, 입력, 설명)
line-height.label        1.2
line-height.body         1.4                   (모달 본문)

radius.default           20px
radius.box               15px
radius.seat              8px
radius.bar               4px
radius.progress          3px
radius.full              9999px

border.width.default     1px
border.width.selected    3px

layout.frame-width       402px
layout.content-width     339px
layout.gutter            32px                   (31–32 혼재)
layout.tabbar-height     75px

size.button-lg           52px (높이)
size.button-md           48px
size.button-sm           40px
size.input               52px
size.icon                24px

spacing                  5 / 6 / 8 / 12 / 14px  (auto-layout에서 확인된 값만)
```

- `shadow.*`: 없음.
- `breakpoint.*`: 없음(모바일 디자인만 존재).

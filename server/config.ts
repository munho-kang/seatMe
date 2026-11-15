// 서버 설정 (Java 서버의 application.properties 자리).

/** 인증키 세 개. 배포된 서버는 Cloudflare 비밀 보관함에서, 내 컴퓨터에서는 .dev.vars 파일에서 온다 (저장소에 안 올라감). */
export type Env = { MOLIT_SERVICE_KEY?: string; KAC_API_KEY?: string; KMA_SERVICE_KEY?: string }

/** 공공데이터 주소와 제한 시간. 테스트가 가짜 서버 주소 · 짧은 시간으로 바꿔 끼운다. */
export const config = {
  // 국토교통부(TAGO) 국내항공운항정보 — https://www.data.go.kr/data/15098526/openapi.do
  molitBaseUrl: 'https://apis.data.go.kr/1613000/DmstcFlightNvgInfo',
  // 국토부가 이 시간 안에 답하지 않으면 포기하고 502 (5초)
  molitTimeoutMs: 5000,
  // 한국공항공사 기종 API
  kacBaseUrl: 'https://apis.data.go.kr/B551178/flight-aircraft-status/info',
  // 공항공사가 이 시간 안에 답하지 않으면 기종만 비우고 항공편 목록은 보여준다 (5초)
  kacTimeoutMs: 5000,
  // 기상청 단기예보 — https://www.data.go.kr/data/15084084/openapi.do (추천에 붙는 날씨 한 줄)
  kmaBaseUrl: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0',
  // 기상청이 이 시간 안에 답하지 않으면 날씨 한 줄만 빼고 추천은 그대로 나간다 (3초)
  kmaTimeoutMs: 3000,
}

/**
 * 주소에 넣을 인증키. 비어 있으면 ''.
 * 포털은 키를 Encoding/Decoding 두 가지로 보여 준다. Decoding 키는 여기서 부호화하고, 이미 부호화된(% 포함) Encoding 키는 그대로 쓴다.
 */
export function encodeKey(key: string | undefined): string {
  return !key ? '' : key.includes('%') ? key : encodeURIComponent(key)
}

/** 글자 안의 인증키(원문 · 부호화된 모양 모두)를 '<key>'로 바꾼다. 로그에 쓰는 글자는 전부 이걸 거친다. */
export function redact(text: string, env: Env): string {
  for (const key of [env.MOLIT_SERVICE_KEY, env.KAC_API_KEY, env.KMA_SERVICE_KEY])
    if (key) text = text.replaceAll(encodeURIComponent(key), '<key>').replaceAll(key, '<key>')
  return text
}

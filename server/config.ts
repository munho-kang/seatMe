// 서버 설정 (Java 서버의 application.properties 자리).

/**
 * 인증키 · 비밀값. 배포된 서버는 Cloudflare 비밀 보관함에서, 내 컴퓨터에서는 .dev.vars 파일에서 온다 (저장소에 안 올라감).
 * NAVER_* 는 네이버 개발자센터 앱의 값, SESSION_SECRET은 로그인 쿠키 서명 키(아무 긴 무작위 글자).
 * PROFILES는 취향 보관함(Cloudflare KV, wrangler.jsonc의 kv_namespaces).
 */
export type Env = {
  MOLIT_SERVICE_KEY?: string; KAC_API_KEY?: string; KMA_SERVICE_KEY?: string
  NAVER_CLIENT_ID?: string; NAVER_CLIENT_SECRET?: string; SESSION_SECRET?: string
  PROFILES?: { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<unknown> }
}

/** 공공데이터 주소와 제한 시간. 테스트가 가짜 서버 주소 · 짧은 시간으로 바꿔 끼운다. */
export const config = {
  // 국토교통부(TAGO) 국내항공운항정보 — https://www.data.go.kr/data/15098526/openapi.do
  molitBaseUrl: 'https://apis.data.go.kr/1613000/DmstcFlightNvgInfo',
  // 국토부가 이 시간 안에 답하지 않으면 다시 묻고(아래 publicDataTries), 끝까지 답이 없으면 502 (한 번에 2초)
  molitTimeoutMs: 2000,
  // 한국공항공사 기종 API
  kacBaseUrl: 'https://apis.data.go.kr/B551178/flight-aircraft-status/info',
  // 공항공사가 이 시간 안에 답하지 않으면 다시 묻고, 끝까지 답이 없으면 기종만 비우고 항공편 목록은 보여준다 (한 번에 2초)
  kacTimeoutMs: 2000,
  // 국토부 · 공항공사에 같은 요청을 모두 몇 번까지 보내는지. 배포된 서버에서 공공데이터로 가는 연결이 가끔 그냥 멈춘다
  // (2026-11-15 측정: 검색 16번 중 6번, 추천 16번 중 5번. 답할 때는 한 번에 0.6초 안, 멈추면 5초를 넘겨도 답이 없다. 같은 때 이 컴퓨터에서 직접 부른 60번은 전부 0.2초 안)
  publicDataTries: 3,
  // 기상청 단기예보 — https://www.data.go.kr/data/15084084/openapi.do (추천에 붙는 날씨 한 줄)
  kmaBaseUrl: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0',
  // 기상청이 이 시간 안에 답하지 않으면 한 번 더 묻고, 그래도 없으면 날씨 한 줄만 빼고 추천은 그대로 나간다 (한 번에 3초)
  // 평소 답은 1.2 ~ 1.7초. 날씨는 설명 한 줄이라 추천을 오래 붙잡지 않도록 두 번까지만 묻는다 (weather/kma.ts)
  kmaTimeoutMs: 3000,
  // 네이버 로그인 — https://developers.naver.com/docs/login/devguide/devguide.md
  naverAuthUrl: 'https://nid.naver.com/oauth2.0',
  naverApiUrl: 'https://openapi.naver.com',
  // 네이버가 이 시간 안에 답하지 않으면 로그인 실패로 첫 화면에 돌려보낸다 (5초)
  naverTimeoutMs: 5000,
}

/**
 * 주소에 넣을 인증키. 비어 있으면 ''.
 * 포털은 키를 Encoding/Decoding 두 가지로 보여 준다. Decoding 키는 여기서 부호화하고, 이미 부호화된(% 포함) Encoding 키는 그대로 쓴다.
 */
export function encodeKey(key: string | undefined): string {
  return !key ? '' : key.includes('%') ? key : encodeURIComponent(key)
}

/**
 * 공공데이터 주소를 불러 상태와 몸통 글자를 받는다. timeoutMs 안에 답이 없거나 연결이 안 되면 같은 요청을 다시 보낸다 (모두 tries번).
 * 끝까지 안 되면 마지막 오류를 던진다. 오류 답(HTTP 오류 · 오류 몸통)은 답이 온 것이라 다시 묻지 않는다.
 */
export async function fetchPublicData(url: string, timeoutMs: number, tries = config.publicDataTries): Promise<{ status: number; body: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      return { status: response.status, body: await response.text() }
    } catch (e) {
      if (attempt >= tries) throw e
      // 주소의 ? 뒤에는 인증키가 있어 경로만 남긴다
      console.warn(`공공데이터 ${new URL(url).pathname} 가 답하지 않아 다시 묻는다 (${attempt + 1}/${tries}번째)`)
    }
  }
}

/** 글자 안의 인증키 · 비밀값(원문 · 부호화된 모양 모두)를 '<key>'로 바꾼다. 로그에 쓰는 글자는 전부 이걸 거친다. */
export function redact(text: string, env: Env): string {
  for (const key of [env.MOLIT_SERVICE_KEY, env.KAC_API_KEY, env.KMA_SERVICE_KEY, env.NAVER_CLIENT_SECRET, env.SESSION_SECRET])
    if (key) text = text.replaceAll(encodeURIComponent(key), '<key>').replaceAll(key, '<key>')
  return text
}

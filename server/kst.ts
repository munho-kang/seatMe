// 한국 시각 ↔ epoch ms.
// Cloudflare Worker의 시계는 UTC다. 현지 시각 함수(getHours 등)를 쓰지 않고 이 파일의 함수만 쓴다.
// ponytail: 한국은 서머타임이 없어 UTC+9로 고정했다. 다른 나라 시각을 다루게 되면 Temporal로 바꾼다.
const OFFSET = 9 * 3600_000

/** epoch ms → '2026-11-13T14:10:00.000' (한국 시각). */
export function kst(ms: number): string {
  return new Date(ms + OFFSET).toISOString().slice(0, 23)
}

/** ('2026-11-13', '14:10') → epoch ms. 모양이 틀리거나 없는 날짜(2026-02-30)면 NaN. */
export function fromKst(date: string, time: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN
  const ms = Date.parse(`${date}T${time}:00+09:00`)
  // Date.parse는 2월 30일을 3월 2일로 넘겨 버린다. 되돌려서 같은 날짜인지 본다
  return !Number.isNaN(ms) && kst(ms).slice(0, 10) === date ? ms : NaN
}

/** epoch ms → '202611131410' (공공데이터의 yyyyMMddHHmm, 한국 시각). */
export function compact(ms: number): string {
  return kst(ms).replace(/[-T:]/g, '').slice(0, 12)
}

/** '202611131410' → epoch ms. 숫자 12개가 아니거나 없는 날짜면 NaN. */
export function fromCompact(text: string): number {
  if (!/^\d{12}$/.test(text)) return NaN
  return fromKst(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`, `${text.slice(8, 10)}:${text.slice(10, 12)}`)
}

import { seatMaps } from './repository.ts'

// 화면이 부르는 창구 — GET /api/seatmaps (요약 목록), GET /api/seatmaps/{id} (배치도 하나).
// 없는 id는 어떤 글자든 404 {"error":"SEAT_MAP_NOT_FOUND"}.

export function seatMapListApi(): Response {
  return Response.json({
    seatMaps: seatMaps.all().map(m => ({ id: m.id, airline: m.airline, aircraft: m.aircraft, name: m.name, seatCount: m.seatCount })),
  })
}

/** id가 null이면(주소를 풀 수 없으면) 없는 배치도다. */
export function seatMapApi(id: string | null): Response {
  const map = seatMaps.findById(id)
  return map ? Response.json(map) : Response.json({ error: 'SEAT_MAP_NOT_FOUND' }, { status: 404 })
}

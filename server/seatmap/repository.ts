import { seatMapFiles } from '../seatmaps/index.ts'
import { expand, type SeatMap, type SeatMapFile } from './seatMap.ts'

/** 후보 id들(대표가 맨 앞)과, 그 편의 배치로 확정했는지. */
export type Candidates = { ids: string[]; confirmed: boolean }

/**
 * "항공사 + 빈칸 + 기종 코드" 중 항공사에 배치가 더 있는데 일부만 옮겨 적은 조합. 후보가 하나여도 확정하지 않는다.
 * 파라타 A320은 공식 페이지에 174 · 168 · 156석 세 배치가 있는데 "국내선"이라 적힌 174석만 옮겼다. 배치를 다 옮기면 이 줄에서 지운다.
 */
export const INCOMPLETE = new Set(['WE A320'])

/** 배치도 파일을 전부 펼쳐 두고, id로 찾거나 편에 맞는 후보를 고른다. 틀린 파일이 있으면 만들 때 멈춘다. */
export class SeatMapRepository {
  #files: SeatMapFile[] // 항공사 → order → id 순
  #byId = new Map<string, SeatMap>() // 같은 순서

  constructor(input: SeatMapFile[]) {
    this.#files = [...input].sort((a, b) => compare(a.airline, b.airline) || a.order - b.order || compare(a.id, b.id))
    const orders = new Set<string>() // 항공사 + 기종 코드 + order
    const registrationOwner = new Map<string, string>()
    for (const f of this.#files) {
      let map: SeatMap
      try {
        map = expand(f)
      } catch (e) {
        throw new Error(`${f.id}: 배치도 파일을 펼치지 못했다 (${e instanceof Error ? e.message : e})`, { cause: e })
      }
      if (this.#byId.has(f.id)) throw new Error('id가 겹친다: ' + f.id)
      this.#byId.set(f.id, map)
      for (const code of f.aircraftCodes) {
        const key = `${f.airline}/${code}/${f.order}`
        if (orders.has(key))
          throw new Error(`${f.id}: 같은 항공사 + 기종 ${f.airline} ${code}에 order ${f.order}가 겹친다`)
        orders.add(key)
      }
      for (const reg of f.registrations ?? []) {
        const other = registrationOwner.get(reg)
        if (other !== undefined) throw new Error(`${f.id}: 등록번호 ${reg}가 ${other}에도 있다`)
        registrationOwner.set(reg, f.id)
      }
    }
  }

  findById(id: string | null | undefined): SeatMap | undefined {
    return id == null ? undefined : this.#byId.get(id)
  }

  /** 항공사 → order → id 순. */
  all(): SeatMap[] {
    return [...this.#byId.values()]
  }

  files(): SeatMapFile[] {
    return this.#files
  }

  candidatesFor(
    airline: string | null | undefined,
    aircraftCode: string | null | undefined,
    registration: string | null | undefined,
  ): Candidates {
    if (!airline?.trim() || !aircraftCode?.trim()) return { ids: [], confirmed: false }
    const match = this.#files.filter(f => airline === f.airline && f.aircraftCodes.includes(aircraftCode))
    if (registration?.trim()) {
      const reg = registration.trim().toUpperCase()
      for (const f of match) if (f.registrations?.includes(reg)) return { ids: [f.id], confirmed: true }
    }
    return {
      ids: match.map(f => f.id),
      confirmed: match.length === 1 && !INCOMPLETE.has(`${airline} ${aircraftCode}`),
    }
  }
}

/** 글자 순서 비교 (코드 단위 비교). 값이 없으면 맨 앞. */
function compare(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : -1) : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** 실제 배치도 40개. 서버가 뜰 때 한 번 펼친다. 틀린 파일이 있으면 여기서 멈춰 서버가 뜨지 않는다 (Cloudflare가 배포를 거절한다). */
export const seatMaps = new SeatMapRepository(seatMapFiles)

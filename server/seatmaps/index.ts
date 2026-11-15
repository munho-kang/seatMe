// 좌석 배치도 파일 목록. Cloudflare Worker는 폴더를 읽지 못해서 파일을 한 줄씩 적어 불러온다.
// 배치도 파일을 더하거나 지우면 아래 두 곳(import 줄과 목록)에 같이 적는다. 잊으면 files.test.ts가 실패한다.
import type { SeatMapFile } from '../seatmap/seatMap.ts'
import f7C_B38M_174 from './7C-B38M-174.json' with { type: 'json' }
import f7C_B38M_189 from './7C-B38M-189.json' with { type: 'json' }
import f7C_B738_174 from './7C-B738-174.json' with { type: 'json' }
import f7C_B738_189 from './7C-B738-189.json' with { type: 'json' }
import fBX_A21N_220 from './BX-A21N-220.json' with { type: 'json' }
import fBX_A21N_232 from './BX-A21N-232.json' with { type: 'json' }
import fBX_A320_HL7744 from './BX-A320-HL7744.json' with { type: 'json' }
import fBX_A321_HL7210 from './BX-A321-HL7210.json' with { type: 'json' }
import fBX_A321_HL7211 from './BX-A321-HL7211.json' with { type: 'json' }
import fBX_A321_HL7729 from './BX-A321-HL7729.json' with { type: 'json' }
import fBX_A321_HL7730 from './BX-A321-HL7730.json' with { type: 'json' }
import fBX_A321_HL8099 from './BX-A321-HL8099.json' with { type: 'json' }
import fBX_A321_HL8365 from './BX-A321-HL8365.json' with { type: 'json' }
import fKE_A21N_180 from './KE-A21N-180.json' with { type: 'json' }
import fKE_A21N_182 from './KE-A21N-182.json' with { type: 'json' }
import fKE_A21N_188 from './KE-A21N-188.json' with { type: 'json' }
import fKE_A321_174 from './KE-A321-174.json' with { type: 'json' }
import fKE_A333_272 from './KE-A333-272.json' with { type: 'json' }
import fKE_A333_276 from './KE-A333-276.json' with { type: 'json' }
import fKE_A333_284 from './KE-A333-284.json' with { type: 'json' }
import fKE_A333_290 from './KE-A333-290.json' with { type: 'json' }
import fKE_A333_298 from './KE-A333-298.json' with { type: 'json' }
import fKE_B739_173 from './KE-B739-173.json' with { type: 'json' }
import fKE_B739_188 from './KE-B739-188.json' with { type: 'json' }
import fKE_BCS3_140 from './KE-BCS3-140.json' with { type: 'json' }
import fLJ_A321_174 from './LJ-A321-174.json' with { type: 'json' }
import fLJ_B738_189 from './LJ-B738-189.json' with { type: 'json' }
import fLJ_B739_188 from './LJ-B739-188.json' with { type: 'json' }
import fLJ_B772_393 from './LJ-B772-393.json' with { type: 'json' }
import fOZ_A321_174 from './OZ-A321-174.json' with { type: 'json' }
import fOZ_A333_290 from './OZ-A333-290.json' with { type: 'json' }
import fOZ_A333_298 from './OZ-A333-298.json' with { type: 'json' }
import fRS_A321_195 from './RS-A321-195.json' with { type: 'json' }
import fRS_A321_220_1 from './RS-A321-220-1.json' with { type: 'json' }
import fRS_A321_220_2 from './RS-A321-220-2.json' with { type: 'json' }
import fTW_B38M_189 from './TW-B38M-189.json' with { type: 'json' }
import fTW_B738_189 from './TW-B738-189.json' with { type: 'json' }
import fWE_A320_174 from './WE-A320-174.json' with { type: 'json' }
import fZE_B738_186 from './ZE-B738-186.json' with { type: 'json' }
import fZE_B738_189 from './ZE-B738-189.json' with { type: 'json' }

export const seatMapFiles: SeatMapFile[] = [
  f7C_B38M_174,
  f7C_B38M_189,
  f7C_B738_174,
  f7C_B738_189,
  fBX_A21N_220,
  fBX_A21N_232,
  fBX_A320_HL7744,
  fBX_A321_HL7210,
  fBX_A321_HL7211,
  fBX_A321_HL7729,
  fBX_A321_HL7730,
  fBX_A321_HL8099,
  fBX_A321_HL8365,
  fKE_A21N_180,
  fKE_A21N_182,
  fKE_A21N_188,
  fKE_A321_174,
  fKE_A333_272,
  fKE_A333_276,
  fKE_A333_284,
  fKE_A333_290,
  fKE_A333_298,
  fKE_B739_173,
  fKE_B739_188,
  fKE_BCS3_140,
  fLJ_A321_174,
  fLJ_B738_189,
  fLJ_B739_188,
  fLJ_B772_393,
  fOZ_A321_174,
  fOZ_A333_290,
  fOZ_A333_298,
  fRS_A321_195,
  fRS_A321_220_1,
  fRS_A321_220_2,
  fTW_B38M_189,
  fTW_B738_189,
  fWE_A320_174,
  fZE_B738_186,
  fZE_B738_189,
]

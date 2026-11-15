const NAMES = new Map([
  ['B738', 'B737-800'],
  ['B38M', 'B737-8'],
  ['B739', 'B737-900'],
  ['BCS3', 'A220-300'],
  ['A21N', 'A321neo'],
  ['A333', 'A330-300'],
  ['A321', 'A321'],
  ['A320', 'A320'],
  ['B772', 'B777-200'],
])

/** 공항공사 기종 코드를 화면에 보이는 이름으로 바꾼다. 표에 없으면 코드 그대로. */
export function aircraftName(code: string): string {
  return NAMES.get(code) ?? code
}

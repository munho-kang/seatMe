import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compact, fromCompact, fromKst, kst } from './kst.ts'

test('한국 시각으로 바꾼다', () => {
  assert.equal(kst(Date.UTC(2026, 10, 13, 5, 10)), '2026-11-13T14:10:00.000')
  assert.equal(fromKst('2026-11-13', '14:10'), Date.UTC(2026, 10, 13, 5, 10))
  assert.equal(compact(Date.UTC(2026, 10, 13, 5, 10)), '202611131410')
  assert.equal(fromCompact('202611131410'), Date.UTC(2026, 10, 13, 5, 10))
})

// Worker의 시계는 UTC다. 한국 00:00~08:59에는 UTC 날짜가 어제다
test('한국_자정_직후에도_한국_날짜다 (JS)', () => {
  assert.equal(kst(Date.UTC(2026, 10, 14, 15, 30)).slice(0, 10), '2026-11-15')
})

test('없는 날짜와 틀린 모양은 NaN', () => {
  for (const [d, t] of [
    ['2026-02-30', '10:00'],
    ['2026-13-01', '10:00'],
    ['+12345-01-01', '10:00'],
    ['2026-1-1', '10:00'],
    ['2026-11-13', '24:00'],
    ['2026-11-13', '9:00'],
  ])
    assert.ok(Number.isNaN(fromKst(d, t)), `${d} ${t}`)
  for (const c of ['20261113141', '2026111314100', '202613131410', 'abcdefghijkl'])
    assert.ok(Number.isNaN(fromCompact(c)), c)
})

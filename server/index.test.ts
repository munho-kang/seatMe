import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeKey, redact } from './config.ts'
import { handle } from './index.ts'

test('모르는 주소는 404, GET이 아니면 405 — 화면(index.html)이 대신 답하지 않는다', async () => {
  const miss = await handle(new Request('http://x/api/nope'), {})
  assert.equal(miss.status, 404)
  assert.deepEqual(await miss.json(), { error: 'NOT_FOUND' })
  const post = await handle(new Request('http://x/api/flights', { method: 'POST' }), {})
  assert.equal(post.status, 405)
  assert.deepEqual(await post.json(), { error: 'METHOD_NOT_ALLOWED' })
})

test('인증키를 가린다', () => {
  const env = { MOLIT_SERVICE_KEY: 'ab+/=', KAC_API_KEY: 'kac', KMA_SERVICE_KEY: '' }
  assert.equal(encodeKey('ab+/='), 'ab%2B%2F%3D')
  assert.equal(encodeKey('ab%2B'), 'ab%2B')
  assert.equal(encodeKey(undefined), '')
  // 빈 키로 글자를 망가뜨리지 않는다
  assert.equal(redact('u?serviceKey=ab%2B%2F%3D&x ab+/= kac', env), 'u?serviceKey=<key>&x <key> <key>')
})

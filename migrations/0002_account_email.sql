-- 이메일 계정 기록(account:<id>)에 이메일을 같이 둔다 — 회원 탈퇴할 때 email:<이메일> 기록을 찾아 지우려고 (server/auth/email.ts, 2026-11-17)
-- 새로 가입하는 계정은 서버가 넣는다. 이 파일은 그 전에 가입한 계정만 채운다
UPDATE kv SET value = json_set(value, '$.email',
  (SELECT substr(e.key, 7) FROM kv AS e WHERE e.key LIKE 'email:%' AND json_extract(e.value, '$.id') = substr(kv.key, 9)))
WHERE key LIKE 'account:%' AND json_extract(value, '$.email') IS NULL;

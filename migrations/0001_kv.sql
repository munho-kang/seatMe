-- 취향 · 기록 · 이메일 계정 보관함. KV 때와 같은 모양: 열쇠 하나 → 값(JSON 글자) 하나 (server/config.ts d1Store)
CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);

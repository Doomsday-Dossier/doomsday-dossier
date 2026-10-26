-- Arena votes. One row per unordered matchup (slugs in alphabetical order: a < b).
CREATE TABLE IF NOT EXISTS tallies (
  pair    TEXT PRIMARY KEY,   -- "a|b"
  a       TEXT NOT NULL,
  b       TEXT NOT NULL,
  va      INTEGER NOT NULL DEFAULT 0,
  vb      INTEGER NOT NULL DEFAULT 0,
  total   INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tallies_total ON tallies (total DESC, updated DESC);

-- "Already voted today" markers: a daily-rotating HMAC of IP, user agent and matchup.
-- Not reversible, deleted after a day. No personal data is stored.
CREATE TABLE IF NOT EXISTS seen (
  k   TEXT PRIMARY KEY,
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS seen_day ON seen (day);

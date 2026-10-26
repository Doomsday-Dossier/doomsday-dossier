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

-- Fan predictions. One row per predictor (a random id kept in their browser), one row per answer.
CREATE TABLE IF NOT EXISTS pred_people (
  pid     TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pred_picks (
  pid TEXT NOT NULL,
  q   TEXT NOT NULL,
  opt TEXT NOT NULL,
  PRIMARY KEY (pid, q)
);
CREATE INDEX IF NOT EXISTS pred_picks_q ON pred_picks (q, opt);
-- New prediction sets started per browser per day (daily HMAC key, deleted the next day).
CREATE TABLE IF NOT EXISTS pred_new (
  k   TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  n   INTEGER NOT NULL
);

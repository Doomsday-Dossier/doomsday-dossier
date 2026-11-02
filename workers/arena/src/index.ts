/**
 * Doomsday Dossier arena API (Cloudflare Worker + D1).
 *
 *   POST /vote    { a, b, pick, token }  one fan vote; returns the matchup's new tally
 *   GET  /result?a=&b=                   the fan split for one matchup
 *   GET  /top?limit=10                   most-wanted fights: matchups with the most votes
 *   POST /predict { pid?, picks, token } a full set of fan predictions (until the seal)
 *   GET  /predict/split                  how fans have answered each prediction
 *   POST /threat  { slug, rating, token } a fan's threat rating, 1 (nuisance) to 4 (worthy of Doom)
 *   GET  /threat                         every target's fan threat: count and average
 *
 * Spam: every vote needs a valid Turnstile token, and each visitor gets one vote per
 * matchup per day. "Visitor" is an HMAC of IP and user agent keyed by a secret and the
 * date, so the key rotates daily and cannot be reversed; no IP, account or cookie is kept.
 * Votes are fan opinion: the site labels them that way.
 */
import ROSTER from './roster.json';
// the approved prediction questions, shared with the site so the two can never disagree
import PRED from '../../../research/predictions.json';

export interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  HASH_SECRET: string;
  ALLOWED_ORIGINS: string; // comma separated
}

const SLUGS = new Set<string>(ROSTER);
const SEAL = Date.parse(PRED.seal);
const QUESTIONS = new Map<string, Set<string>>(PRED.questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))]));
const NEW_PER_DAY = 5; // new prediction sets one browser can start in a day
const enc = new TextEncoder();

const today = () => new Date().toISOString().slice(0, 10);
/** One row per unordered pair, stored alphabetically so A-vs-B and B-vs-A share a tally. */
const pairOf = (a: string, b: string) => (a < b ? [a, b] : [b, a]) as [string, string];

async function visitor(env: Env, req: Request, pair: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${env.HASH_SECRET}:${today()}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const ua = req.headers.get('User-Agent') || '';
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${ip}|${ua}|${pair}`));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function human(env: Env, req: Request, token: unknown) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  const ip = req.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const j = (await r.json()) as { success: boolean };
  return j.success === true;
}

function cors(env: Env, req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data: unknown, headers: Record<string, string>, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': cache } });

async function tally(env: Env, a: string, b: string) {
  const [x, y] = pairOf(a, b);
  const row = await env.DB.prepare('SELECT va, vb, total FROM tallies WHERE pair = ?').bind(`${x}|${y}`).first<{ va: number; vb: number; total: number }>();
  const va = row?.va ?? 0, vb = row?.vb ?? 0;
  // report in the caller's order
  return a === x ? { a, b, votesA: va, votesB: vb, total: va + vb } : { a, b, votesA: vb, votesB: va, total: va + vb };
}

/** How fans have answered each prediction so far. */
async function split(env: Env) {
  const [people, rows] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM pred_people').first<{ n: number }>(),
    env.DB.prepare('SELECT q, opt, COUNT(*) AS n FROM pred_picks GROUP BY q, opt').all<{ q: string; opt: string; n: number }>(),
  ]);
  const q: Record<string, Record<string, number>> = {};
  for (const r of rows.results) (q[r.q] ??= {})[r.opt] = r.n;
  return { total: people?.n ?? 0, q, seal: PRED.seal };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/result') {
      const a = url.searchParams.get('a') || '', b = url.searchParams.get('b') || '';
      if (!SLUGS.has(a) || !SLUGS.has(b) || a === b) return json({ error: 'unknown matchup' }, h, 400);
      return json(await tally(env, a, b), h, 200, 'public, max-age=5');
    }

    if (req.method === 'GET' && url.pathname === '/top') {
      const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit')) || 10));
      const { results } = await env.DB.prepare('SELECT a, b, va, vb, total FROM tallies ORDER BY total DESC, updated DESC LIMIT ?').bind(limit).all();
      return json({ fights: results.map((r: any) => ({ a: r.a, b: r.b, votesA: r.va, votesB: r.vb, total: r.total })) }, h, 200, 'public, max-age=15');
    }

    if (req.method === 'POST' && url.pathname === '/vote') {
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'bad request' }, h, 400); }
      const { a, b, pick, token } = body || {};
      if (!SLUGS.has(a) || !SLUGS.has(b) || a === b || (pick !== a && pick !== b)) return json({ error: 'unknown matchup' }, h, 400);
      if (!(await human(env, req, token))) return json({ error: 'bot check failed' }, h, 403);
      const [x, y] = pairOf(a, b);
      const pair = `${x}|${y}`;
      const seen = await visitor(env, req, pair);
      const day = today();
      // one vote per visitor per matchup per day; INSERT OR IGNORE makes the check atomic
      const first = await env.DB.prepare('INSERT OR IGNORE INTO seen (k, day) VALUES (?, ?)').bind(seen, day).run();
      if (!first.meta.changes) return json({ ...(await tally(env, a, b)), already: true }, h);
      const col = pick === x ? 'va' : 'vb';
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO tallies (pair, a, b, va, vb, total, updated) VALUES (?, ?, ?, 0, 0, 0, ?) ON CONFLICT(pair) DO NOTHING`).bind(pair, x, y, Date.now()),
        env.DB.prepare(`UPDATE tallies SET ${col} = ${col} + 1, total = total + 1, updated = ? WHERE pair = ?`).bind(Date.now(), pair),
        // keep only today's and yesterday's markers
        env.DB.prepare('DELETE FROM seen WHERE day < ?').bind(new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
      ]);
      return json({ ...(await tally(env, a, b)), already: false }, h);
    }

    if (req.method === 'GET' && url.pathname === '/threat') {
      const { results } = await env.DB.prepare('SELECT slug, n, sum FROM threat').all<{ slug: string; n: number; sum: number }>();
      const t: Record<string, { n: number; avg: number }> = {};
      for (const r of results) if (SLUGS.has(r.slug) && r.n) t[r.slug] = { n: r.n, avg: Math.round((r.sum / r.n) * 100) / 100 };
      return json({ threat: t }, h, 200, 'public, max-age=15');
    }

    if (req.method === 'POST' && url.pathname === '/threat') {
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'bad request' }, h, 400); }
      const { slug, rating, token } = body || {};
      // Doom is the measure, never his own threat
      if (!SLUGS.has(slug) || slug === 'victor-von-doom' || ![1, 2, 3, 4].includes(rating)) return json({ error: 'unknown rating' }, h, 400);
      if (!(await human(env, req, token))) return json({ error: 'bot check failed' }, h, 403);
      const day = today();
      // one rating per visitor per target per day, the same atomic marker as the fight votes
      const first = await env.DB.prepare('INSERT OR IGNORE INTO seen (k, day) VALUES (?, ?)').bind(await visitor(env, req, `threat|${slug}`), day).run();
      if (first.meta.changes) {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO threat (slug, n, sum, updated) VALUES (?, 1, ?, ?) ON CONFLICT(slug) DO UPDATE SET n = n + 1, sum = sum + excluded.sum, updated = excluded.updated').bind(slug, rating, Date.now()),
          env.DB.prepare('DELETE FROM seen WHERE day < ?').bind(new Date(Date.now() - 86400000).toISOString().slice(0, 10)),
        ]);
      }
      const row = await env.DB.prepare('SELECT n, sum FROM threat WHERE slug = ?').bind(slug).first<{ n: number; sum: number }>();
      return json({ slug, n: row?.n ?? 0, avg: row?.n ? Math.round((row.sum / row.n) * 100) / 100 : null, already: !first.meta.changes }, h);
    }

    if (req.method === 'GET' && url.pathname === '/predict/split') {
      return json(await split(env), h, 200, 'public, max-age=20');
    }

    if (req.method === 'POST' && url.pathname === '/predict') {
      if (Date.now() >= SEAL) return json({ error: 'sealed' }, h, 403);
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'bad request' }, h, 400); }
      const { pid, picks, token } = body || {};
      // a full set of answers, every one a real option
      if (!picks || typeof picks !== 'object' || Object.keys(picks).length !== QUESTIONS.size) return json({ error: 'answer every question' }, h, 400);
      for (const [q, opts] of QUESTIONS) if (!opts.has(picks[q])) return json({ error: 'unknown answer' }, h, 400);
      if (!(await human(env, req, token))) return json({ error: 'bot check failed' }, h, 403);
      const now = Date.now();
      let id = typeof pid === 'string' && /^[0-9a-f-]{36}$/.test(pid) ? pid : '';
      const known = id ? await env.DB.prepare('SELECT pid FROM pred_people WHERE pid = ?').bind(id).first() : null;
      if (!known) {
        // starting a new set: capped per browser per day so the board cannot be stuffed
        const k = await visitor(env, req, 'predict');
        const row = await env.DB.prepare('SELECT n FROM pred_new WHERE k = ?').bind(k).first<{ n: number }>();
        if ((row?.n ?? 0) >= NEW_PER_DAY) return json({ error: 'too many new prediction sets today' }, h, 429);
        id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare('INSERT INTO pred_new (k, day, n) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1').bind(k, today()),
          env.DB.prepare('DELETE FROM pred_new WHERE day < ?').bind(today()),
          env.DB.prepare('INSERT INTO pred_people (pid, created, updated) VALUES (?, ?, ?)').bind(id, now, now),
        ]);
      } else {
        await env.DB.prepare('UPDATE pred_people SET updated = ? WHERE pid = ?').bind(now, id).run();
      }
      await env.DB.batch([
        env.DB.prepare('DELETE FROM pred_picks WHERE pid = ?').bind(id),
        ...[...QUESTIONS.keys()].map((q) => env.DB.prepare('INSERT INTO pred_picks (pid, q, opt) VALUES (?, ?, ?)').bind(id, q, picks[q])),
      ]);
      return json({ pid: id, ...(await split(env)) }, h);
    }

    return json({ error: 'not found' }, h, 404);
  },
};

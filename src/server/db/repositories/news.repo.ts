import { getPool, sql } from '../pool';
import { toIso } from '../utils';
import type { NewsKeywordDTO } from '@/lib/types';

// ── Keywords ─────────────────────────────────────────────────────────────────

interface KeywordRow {
  id: number;
  keyword: string;
  client_id: number | null;
  client_name: string | null;
  is_competitor: boolean | number;
  created_at: unknown;
}

function mapKeyword(r: KeywordRow): NewsKeywordDTO {
  return {
    id: Number(r.id),
    keyword: String(r.keyword),
    clientId: r.client_id != null ? Number(r.client_id) : null,
    clientName: r.client_name ? String(r.client_name) : null,
    isCompetitor: Boolean(r.is_competitor),
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  };
}

export async function listKeywords(): Promise<NewsKeywordDTO[]> {
  const pool = await getPool();
  const res = await pool.request().query(
    `SELECT k.id, k.keyword, k.client_id, c.name AS client_name, k.is_competitor, k.created_at
     FROM dbo.news_keywords k
     LEFT JOIN dbo.clients c ON c.id = k.client_id
     WHERE k.active = 1
     ORDER BY k.created_at`,
  );
  return (res.recordset as KeywordRow[]).map(mapKeyword);
}

export async function addKeyword(p: {
  keyword: string;
  clientId: number | null;
  createdBy: number;
  isCompetitor?: boolean;
}): Promise<number> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('keyword', sql.NVarChar(200), p.keyword.trim().slice(0, 200))
    .input('clientId', sql.Int, p.clientId ?? null)
    .input('createdBy', sql.Int, p.createdBy)
    .input('isCompetitor', sql.Bit, p.isCompetitor ? 1 : 0)
    .query(
      `INSERT INTO dbo.news_keywords (keyword, client_id, created_by, is_competitor)
       OUTPUT inserted.id
       VALUES (@keyword, @clientId, @createdBy, @isCompetitor)`,
    );
  return Number(res.recordset[0].id);
}

export async function deleteKeyword(id: number): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.Int, id)
    .query(`UPDATE dbo.news_keywords SET active = 0 WHERE id = @id`);
}

// ── Feed cache ────────────────────────────────────────────────────────────────

/** Returns the cached articles JSON if it hasn't expired, otherwise null. */
export async function getCachedFeed(cacheKey: string): Promise<string | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('key', sql.NVarChar(128), cacheKey)
    .query(
      `SELECT articles_json FROM dbo.news_feed_cache
       WHERE cache_key = @key AND expires_at > SYSUTCDATETIME()`,
    );
  const row = res.recordset[0] as { articles_json: string } | undefined;
  return row?.articles_json ?? null;
}

/** Returns stale cached articles JSON regardless of expiry — used as rate-limit fallback. */
export async function getStaleCachedFeed(cacheKey: string): Promise<string | null> {
  const pool = await getPool();
  const res = await pool
    .request()
    .input('key', sql.NVarChar(128), cacheKey)
    .query(`SELECT articles_json FROM dbo.news_feed_cache WHERE cache_key = @key`);
  const row = res.recordset[0] as { articles_json: string } | undefined;
  return row?.articles_json ?? null;
}

/** Upserts the cache entry with the given TTL in hours. */
export async function saveFeedCache(
  cacheKey: string,
  articlesJson: string,
  ttlHours: number,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('key', sql.NVarChar(128), cacheKey)
    .input('json', sql.NVarChar(sql.MAX), articlesJson)
    .input('ttlHours', sql.Int, ttlHours)
    .query(
      `MERGE dbo.news_feed_cache AS t
       USING (SELECT @key AS k) AS s ON t.cache_key = s.k
       WHEN MATCHED THEN
         UPDATE SET articles_json = @json,
                    fetched_at = SYSUTCDATETIME(),
                    expires_at = DATEADD(HOUR, @ttlHours, SYSUTCDATETIME())
       WHEN NOT MATCHED THEN
         INSERT (cache_key, articles_json, expires_at)
         VALUES (@key, @json, DATEADD(HOUR, @ttlHours, SYSUTCDATETIME()));`,
    );
}

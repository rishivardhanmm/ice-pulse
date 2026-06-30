import { ALLOWED_TABLES } from './sql-schema';

export type GuardResult = { ok: true; sql: string } | { ok: false; error: string };

// Whole-word keywords that must never appear in a read-only query.
const BLOCKED = /\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|into|openrowset|opendatasource|openquery|waitfor|shutdown|reconfigure|bulk)\b/i;
const SYSTEM_PROC = /\b(?:x|s)p_\w+/i;
const TABLE_REF = /\b(?:from|join)\s+(?:\[?dbo\]?\.)?\[?([a-zA-Z0-9_]+)\]?/gi;

/**
 * Validates an LLM-generated query is a safe, single, read-only SELECT against
 * only the whitelisted tables. This is the first line of defence; the executor
 * also runs everything in an always-rolled-back transaction.
 */
export function guardSql(raw: string): GuardResult {
  let sql = (raw ?? '').trim();
  if (!sql) return { ok: false, error: 'empty query' };

  // Allow a single trailing semicolon, then forbid any further statement break.
  sql = sql.replace(/;\s*$/, '').trim();
  if (sql.includes(';')) return { ok: false, error: 'multiple statements are not allowed' };

  if (sql.includes('--') || sql.includes('/*')) {
    return { ok: false, error: 'comments are not allowed' };
  }
  if (!/^select\b/i.test(sql)) {
    return { ok: false, error: 'only a single SELECT statement is allowed (no WITH/CTE)' };
  }
  if (BLOCKED.test(sql)) {
    return { ok: false, error: 'query contains a disallowed (non-read-only) keyword' };
  }
  if (SYSTEM_PROC.test(sql)) {
    return { ok: false, error: 'system procedures are not allowed' };
  }

  // Every referenced table must be in the whitelist.
  for (const match of sql.matchAll(TABLE_REF)) {
    const table = match[1].toLowerCase();
    if (!ALLOWED_TABLES.has(table)) {
      return { ok: false, error: `table "${match[1]}" is not allowed` };
    }
  }

  return { ok: true, sql };
}

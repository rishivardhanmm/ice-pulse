/**
 * Common data-connector contract.
 *
 * Every external source (Google Ads now; Meta, Zoho, Canva, Power BI, the
 * company results DB later) implements this interface. The dashboard and the
 * sync scripts depend only on this abstraction, so adding a new source is a
 * matter of adding a folder under src/integrations/ that exports a connector.
 */

export interface ConnectionStatus {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface SyncOptions {
  /** Inclusive start date, YYYY-MM-DD. */
  from: string;
  /** Inclusive end date, YYYY-MM-DD. */
  to: string;
  /** Where the sync was triggered from (for the audit trail). */
  triggeredBy?: 'cli' | 'api' | 'manual' | 'schedule';
}

export interface SyncResult {
  source: string;
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage: string | null;
  syncRunId: number | null;
}

export interface DataConnector {
  /** Human-readable name, e.g. "Google Ads". */
  name: string;
  /** Stable machine key used in sync_runs.source, e.g. "google_ads". */
  source: string;
  testConnection(): Promise<ConnectionStatus>;
  sync(options: SyncOptions): Promise<SyncResult>;
}

import { readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

/**
 * Environment configuration for ICE Pulse.
 *
 * Validated lazily (on first access) so that standalone scripts can load
 * `.env.local` via dotenv BEFORE the schema is parsed. Next.js loads
 * `.env.local` automatically for server code, so `getServerEnv()` works in
 * API routes without any extra setup.
 *
 * SECURITY: never log the parsed values — secrets live here. Use
 * `describeConfigState()` for safe, value-free diagnostics.
 */

const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === '') return def;
      return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
    });

const portish = (def: number) =>
  z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? def : Number(v)),
    z.number().int().positive(),
  );

const numish = (def: number) =>
  z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? def : Number(v)),
    z.number().nonnegative(),
  );

const intish = (def: number) =>
  z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? def : Number(v)),
    z.number().int().nonnegative(),
  );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim());

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  APP_NAME: z.string().default('ICE Pulse'),
  APP_URL: z.string().default('http://localhost:3000'),

  // MSSQL
  MSSQL_AUTH: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'sql' : String(v).trim().toLowerCase()),
    z.enum(['windows', 'sql']),
  ),
  MSSQL_SERVER: z.string().default('localhost'),
  MSSQL_PORT: portish(1433),
  MSSQL_INSTANCE: optionalString,
  MSSQL_DATABASE: z.string().default('IcePulse'),
  MSSQL_USER: optionalString,
  MSSQL_PASSWORD: optionalString,
  MSSQL_ENCRYPT: boolish(false),
  MSSQL_TRUST_SERVER_CERTIFICATE: boolish(true),
  MSSQL_CONNECTION_TIMEOUT_MS: intish(30000),
  MSSQL_REQUEST_TIMEOUT_MS: intish(60000),
  MSSQL_APP_NAME: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'ICE Pulse' : String(v).trim()),
    z.string(),
  ),
  // ODBC driver used for Windows auth (msnodesqlv8). Override if only 17 is installed.
  MSSQL_ODBC_DRIVER: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'ODBC Driver 18 for SQL Server'
        : String(v).trim(),
    z.string(),
  ),

  // Google Ads
  GOOGLE_ADS_DEVELOPER_TOKEN: optionalString,
  GOOGLE_ADS_CLIENT_ID: optionalString,
  GOOGLE_ADS_CLIENT_SECRET: optionalString,
  GOOGLE_ADS_REFRESH_TOKEN: optionalString,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: optionalString,
  GOOGLE_ADS_CUSTOMER_ID: optionalString,
  GOOGLE_ADS_API_VERSION: z.string().default('v24'),
  GOOGLE_ADS_AUTH: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'oauth' : String(v).trim().toLowerCase()),
    z.enum(['oauth', 'service_account']),
  ),
  GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE: optionalString,
  // Preferred for hosting: base64 of the whole key JSON file, pasted as one env var —
  // same pattern as every other secret here, no filesystem/permissions involved.
  // Generate it locally with: certutil -encode key.json key.b64 (strip BEGIN/END lines)
  // or: node -e "console.log(require('fs').readFileSync('key.json').toString('base64'))"
  GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64: optionalString,
  GOOGLE_ADS_IMPERSONATION_EMAIL: optionalString,

  // Meta Ads (Facebook / Instagram)
  META_ACCESS_TOKEN: optionalString,
  META_AD_ACCOUNT_ID: optionalString,  // e.g. act_123456789
  META_APP_ID: optionalString,         // from App Dashboard (Configuration ID)
  META_APP_SECRET: optionalString,     // from App Dashboard > Settings > Basic
  META_API_VERSION: z.string().default('v22.0'),

  // GNews (news feed for News Insights page)
  GNEWS_API_KEY: optionalString,

  // SendGrid (email notifications)
  SENDGRID_API_KEY: optionalString,
  SENDGRID_FROM_EMAIL: optionalString,
  SENDGRID_FROM_NAME: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'ICE Pulse' : String(v).trim()),
    z.string(),
  ),
  // TESTING ONLY: when set, every outgoing email is redirected to this address
  // instead of its real recipient. Unset before real users rely on notifications.
  EMAIL_OVERRIDE_TO: optionalString,

  // AI (OpenAI gpt-4.1-mini by default; provider-agnostic)
  AI_ENABLED: boolish(false),
  AI_PROVIDER: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'openai' : String(v).trim().toLowerCase()),
    z.enum(['openai']),
  ),
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'gpt-4.1-mini' : String(v).trim()),
    z.string(),
  ),
  // Base URL for the OpenAI-compatible API. Default: OpenAI. For Azure AI
  // Foundry use e.g. https://<resource>.services.ai.azure.com/openai/v1
  OPENAI_BASE_URL: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'https://behaviourchangefoundry.services.ai.azure.com/api/projects/proj-default'
        : String(v).trim().replace(/\/+$/, ''),
    z.string(),
  ),
  AI_INPUT_PRICE_PER_1M: numish(0.4),
  AI_OUTPUT_PRICE_PER_1M: numish(1.6),
  AI_MAX_OUTPUT_TOKENS: portish(500),
  AI_SQL_MAX_ATTEMPTS: portish(3),

  // ── Power BI (Microsoft — service principal / app-only) ──────────────
  // Azure AD app: Settings > Certificates & secrets > Client secret value
  POWERBI_TENANT_ID: optionalString,
  POWERBI_CLIENT_ID: optionalString,
  POWERBI_CLIENT_SECRET: optionalString,

  // ── Zoho Social ──────────────────────────────────────────────────────
  // Create a Server-based Application in api-console.zoho.com
  // Scopes: ZohoSocial.profiles.READ ZohoSocial.posts.READ ZohoSocial.reports.READ
  //         ZohoSocial.brands.READ ZohoSocial.posts.CREATE
  ZOHO_SOCIAL_CLIENT_ID: optionalString,
  ZOHO_SOCIAL_CLIENT_SECRET: optionalString,
  // Your Zoho org ID — visible in the Zoho Social URL: /org/{id}/
  ZOHO_SOCIAL_ORG_ID: optionalString,
  // Data-center TLD. 'com' (Global) | 'com.au' (AU) | 'eu' (EU) | 'in' (IN).
  // ICE Creates is on AU, so defaults to 'com.au'.
  ZOHO_SOCIAL_DC: z.preprocess(
    (v) => (v === undefined || String(v).trim() === '' ? 'com.au' : String(v).trim()),
    z.string(),
  ),
  // 32+ char key for AES-256-GCM token encryption (same pattern as Canva).
  ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY: optionalString,
  // Redirect URI registered in the Zoho API Console.
  ZOHO_SOCIAL_REDIRECT_URI: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'http://localhost:3000/api/zoho-social/callback'
        : String(v).trim(),
    z.string(),
  ),

  // ── Canva Connect (Public integration, draft/testing mode — internal only) ──
  // Endpoints default to the documented Canva Connect URLs; override only if the
  // docs change. See docs/canva-integration.md.
  CANVA_CLIENT_ID: optionalString,
  CANVA_CLIENT_SECRET: optionalString,
  // Must EXACTLY match a redirect URL registered in the Canva developer portal.
  // Canva allows http only for 127.0.0.1 in local development.
  CANVA_REDIRECT_URI: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'http://127.0.0.1:3000/api/canva/callback'
        : String(v).trim(),
    z.string(),
  ),
  // Space-separated scopes. Request the minimum your features need.
  CANVA_SCOPES: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'profile:read design:meta:read design:content:read brandtemplate:meta:read asset:read'
        : String(v).trim(),
    z.string(),
  ),
  CANVA_API_BASE_URL: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'https://api.canva.com/rest/v1'
        : String(v).trim().replace(/\/+$/, ''),
    z.string(),
  ),
  CANVA_OAUTH_AUTHORIZE_URL: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'https://www.canva.com/api/oauth/authorize'
        : String(v).trim(),
    z.string(),
  ),
  CANVA_OAUTH_TOKEN_URL: z.preprocess(
    (v) =>
      v === undefined || String(v).trim() === ''
        ? 'https://api.canva.com/rest/v1/oauth/token'
        : String(v).trim(),
    z.string(),
  ),
  // Optional: 32+ char secret used to encrypt OAuth tokens at rest (AES-256-GCM).
  // If unset, tokens are stored obfuscated with a loud warning — set this before
  // any real/production use. NEVER commit the real value.
  CANVA_TOKEN_ENCRYPTION_KEY: optionalString,
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Build the `mssql` connection config from the validated env. Shape depends on
 * the auth mode. `databaseOverride` lets callers target another DB (e.g.
 * "master" when creating the application database).
 */
export function getMssqlConfig(databaseOverride?: string) {
  const env = getServerEnv();
  const usingInstance = env.MSSQL_INSTANCE.length > 0;
  const database = databaseOverride ?? env.MSSQL_DATABASE;
  const base = {
    database,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: env.MSSQL_CONNECTION_TIMEOUT_MS,
    requestTimeout: env.MSSQL_REQUEST_TIMEOUT_MS,
  };

  if (env.MSSQL_AUTH === 'windows') {
    // msnodesqlv8 driver — Windows Integrated Security via an explicit ODBC
    // connection string (the default SNAC driver is usually not installed).
    const server = usingInstance ? `${env.MSSQL_SERVER}\\${env.MSSQL_INSTANCE}` : env.MSSQL_SERVER;
    const encrypt = env.MSSQL_ENCRYPT ? 'Yes' : 'No';
    const trust = env.MSSQL_TRUST_SERVER_CERTIFICATE ? 'Yes' : 'No';
    return {
      connectionString:
        `Driver={${env.MSSQL_ODBC_DRIVER}};Server=${server};Database=${database};` +
        `Trusted_Connection=Yes;Encrypt=${encrypt};TrustServerCertificate=${trust};`,
      pool: base.pool,
      connectionTimeout: base.connectionTimeout,
      requestTimeout: base.requestTimeout,
    };
  }

  // tedious driver — SQL authentication. A named instance is resolved by the
  // SQL Browser, so `port` is omitted when an instance is set.
  return {
    ...base,
    server: env.MSSQL_SERVER,
    port: usingInstance ? undefined : env.MSSQL_PORT,
    user: env.MSSQL_USER || undefined,
    password: env.MSSQL_PASSWORD || undefined,
    options: {
      encrypt: env.MSSQL_ENCRYPT,
      trustServerCertificate: env.MSSQL_TRUST_SERVER_CERTIFICATE,
      instanceName: usingInstance ? env.MSSQL_INSTANCE : undefined,
      appName: env.MSSQL_APP_NAME,
      enableArithAbort: true,
    },
  };
}

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId?: string;
  customerId: string;
  apiVersion: string;
}

/** Returns Google Ads config and asserts the required fields are present. */
export function getGoogleAdsConfig(): GoogleAdsConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
  if (!env.GOOGLE_ADS_CLIENT_ID) missing.push('GOOGLE_ADS_CLIENT_ID');
  if (!env.GOOGLE_ADS_CLIENT_SECRET) missing.push('GOOGLE_ADS_CLIENT_SECRET');
  if (!env.GOOGLE_ADS_REFRESH_TOKEN) missing.push('GOOGLE_ADS_REFRESH_TOKEN');
  if (!env.GOOGLE_ADS_CUSTOMER_ID) missing.push('GOOGLE_ADS_CUSTOMER_ID');
  if (missing.length > 0) {
    throw new Error(
      `Google Ads is not fully configured. Missing: ${missing.join(', ')}. ` +
        `Set these in .env.local (see .env.example).`,
    );
  }
  return {
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    clientId: env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN,
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    customerId: env.GOOGLE_ADS_CUSTOMER_ID,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
  };
}

export type GoogleAdsAuthMode = 'oauth' | 'service_account';

export function getGoogleAdsAuthMode(): GoogleAdsAuthMode {
  return getServerEnv().GOOGLE_ADS_AUTH;
}

export interface GoogleAdsServiceAccountConfig {
  developerToken: string;
  customerId: string;
  loginCustomerId?: string;
  apiVersion: string;
  keyFile: string;
  clientEmail: string;
  privateKey: string;
  impersonationEmail?: string;
}

/**
 * Reads the service-account key JSON from whichever source is configured.
 * GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 (a single env var, no filesystem involved)
 * takes priority; GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE (a path on disk) is the fallback
 * for local dev where a stray file is no hassle.
 */
function readServiceAccountKey(env: ServerEnv): { clientEmail: string; privateKey: string } {
  if (env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64) {
    let json: { client_email?: string; private_key?: string };
    try {
      const raw = Buffer.from(env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
      json = JSON.parse(raw) as typeof json;
    } catch (err) {
      throw new Error(
        `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 is not valid base64-encoded JSON: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!json.client_email || !json.private_key) {
      throw new Error('GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 decodes to JSON missing client_email or private_key.');
    }
    return { clientEmail: json.client_email, privateKey: json.private_key };
  }

  try {
    const raw = readFileSync(env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE, 'utf8');
    const json = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!json.client_email || !json.private_key) {
      throw new Error('the file is missing client_email or private_key');
    }
    return { clientEmail: json.client_email, privateKey: json.private_key };
  } catch (err) {
    const dir = dirname(env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE);
    let dirInfo: string;
    try {
      const entries = readdirSync(dir);
      dirInfo = entries.length ? entries.join(', ') : '(directory exists but is empty)';
    } catch (dirErr) {
      dirInfo = `directory itself is not readable: ${dirErr instanceof Error ? dirErr.message : String(dirErr)}`;
    }
    throw new Error(
      `Could not read the service-account key file at "${env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE}" ` +
        `[platform=${process.platform}, cwd=${process.cwd()}]: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        `Contents of "${dir}": ${dirInfo}`,
    );
  }
}

/**
 * Service-account config (Workspace domain-wide delegation). Reads client_email
 * and private_key from GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 or, failing that, the
 * JSON key file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE, and asserts the required
 * fields are present.
 */
export function getGoogleAdsServiceAccountConfig(): GoogleAdsServiceAccountConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) missing.push('GOOGLE_ADS_DEVELOPER_TOKEN');
  if (!env.GOOGLE_ADS_CUSTOMER_ID) missing.push('GOOGLE_ADS_CUSTOMER_ID');
  if (!env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 && !env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE) {
    missing.push('GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 (or GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE)');
  }
  if (missing.length > 0) {
    throw new Error(
      `Google Ads (service account) is not fully configured. Missing: ${missing.join(', ')}. ` +
        `Set these in .env.local (see .env.example).`,
    );
  }

  const { clientEmail, privateKey } = readServiceAccountKey(env);

  return {
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: env.GOOGLE_ADS_CUSTOMER_ID,
    loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined,
    apiVersion: env.GOOGLE_ADS_API_VERSION,
    keyFile: env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 ? '(base64 env var)' : env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE,
    clientEmail,
    privateKey,
    impersonationEmail: env.GOOGLE_ADS_IMPERSONATION_EMAIL || undefined,
  };
}

/** True when the minimum Google Ads credentials for the active auth mode are present. */
export function isGoogleAdsConfigured(): boolean {
  const env = getServerEnv();
  if (env.GOOGLE_ADS_AUTH === 'service_account') {
    return Boolean(
      env.GOOGLE_ADS_DEVELOPER_TOKEN &&
        env.GOOGLE_ADS_CUSTOMER_ID &&
        (env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_BASE64 || env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_FILE),
    );
  }
  return Boolean(
    env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      env.GOOGLE_ADS_CLIENT_ID &&
      env.GOOGLE_ADS_CLIENT_SECRET &&
      env.GOOGLE_ADS_REFRESH_TOKEN &&
      env.GOOGLE_ADS_CUSTOMER_ID,
  );
}

export interface GNewsConfig {
  apiKey: string;
}

/** True when GNews API key is present. */
export function isGNewsConfigured(): boolean {
  return Boolean(getServerEnv().GNEWS_API_KEY);
}

/** GNews config; throws a clear error when the key is missing. */
export function getGNewsConfig(): GNewsConfig {
  const env = getServerEnv();
  if (!env.GNEWS_API_KEY) {
    throw new Error('GNews is not configured. Set GNEWS_API_KEY in .env.local (free key from gnews.io).');
  }
  return { apiKey: env.GNEWS_API_KEY };
}

export interface MetaAdsConfig {
  accessToken: string;
  adAccountId: string;
  appId?: string;
  appSecret?: string;
  apiVersion: string;
}

/** True when the minimum Meta Ads credentials are present. */
export function isMetaAdsConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.META_ACCESS_TOKEN && env.META_AD_ACCOUNT_ID);
}

/** Meta Ads config; throws a clear error listing what's missing. */
export function getMetaAdsConfig(): MetaAdsConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.META_ACCESS_TOKEN) missing.push('META_ACCESS_TOKEN');
  if (!env.META_AD_ACCOUNT_ID) missing.push('META_AD_ACCOUNT_ID');
  if (missing.length > 0) {
    throw new Error(
      `Meta Ads is not configured. Missing: ${missing.join(', ')}. Set these in .env.local (see .env.example).`,
    );
  }
  return {
    accessToken: env.META_ACCESS_TOKEN,
    adAccountId: env.META_AD_ACCOUNT_ID,
    appId: env.META_APP_ID || undefined,
    appSecret: env.META_APP_SECRET || undefined,
    apiVersion: env.META_API_VERSION,
  };
}

export interface PowerBIConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

/** True when all three Power BI service-principal credentials are present. */
export function isPowerBIConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.POWERBI_TENANT_ID && env.POWERBI_CLIENT_ID && env.POWERBI_CLIENT_SECRET);
}

/** Power BI config; throws a clear error listing what's missing. */
export function getPowerBIConfig(): PowerBIConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.POWERBI_TENANT_ID) missing.push('POWERBI_TENANT_ID');
  if (!env.POWERBI_CLIENT_ID) missing.push('POWERBI_CLIENT_ID');
  if (!env.POWERBI_CLIENT_SECRET) missing.push('POWERBI_CLIENT_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Power BI is not configured. Missing: ${missing.join(', ')}. Set these in .env.local (see .env.example).`,
    );
  }
  return {
    tenantId: env.POWERBI_TENANT_ID,
    clientId: env.POWERBI_CLIENT_ID,
    clientSecret: env.POWERBI_CLIENT_SECRET,
  };
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/** True when the minimum SendGrid credentials (API key + from address) are present. */
export function isEmailConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL);
}

/** SendGrid config; throws a clear error listing what's missing. */
export function getSendGridConfig(): SendGridConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.SENDGRID_API_KEY) missing.push('SENDGRID_API_KEY');
  if (!env.SENDGRID_FROM_EMAIL) missing.push('SENDGRID_FROM_EMAIL');
  if (missing.length > 0) {
    throw new Error(
      `Email is not configured. Missing: ${missing.join(', ')}. Set these in .env.local (see .env.example).`,
    );
  }
  return {
    apiKey: env.SENDGRID_API_KEY,
    fromEmail: env.SENDGRID_FROM_EMAIL,
    fromName: env.SENDGRID_FROM_NAME,
  };
}

export interface AiConfig {
  provider: 'openai';
  apiKey: string;
  baseUrl: string;
  model: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
  maxOutputTokens: number;
  maxSqlAttempts: number;
}

export function isAiConfigured(): boolean {
  const env = getServerEnv();
  return env.AI_ENABLED && env.AI_PROVIDER === 'openai' && Boolean(env.OPENAI_API_KEY);
}

/** AI config; throws a clear error when disabled or the API key is missing. */
export function getAiConfig(): AiConfig {
  const env = getServerEnv();
  if (!env.AI_ENABLED) {
    throw new Error('AI features are disabled. Set AI_ENABLED=true in .env.local.');
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error('AI is enabled but OPENAI_API_KEY is missing. Set it in .env.local.');
  }
  return {
    provider: 'openai',
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_MODEL,
    inputPricePer1M: env.AI_INPUT_PRICE_PER_1M,
    outputPricePer1M: env.AI_OUTPUT_PRICE_PER_1M,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    maxSqlAttempts: env.AI_SQL_MAX_ATTEMPTS,
  };
}

export interface CanvaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  apiBaseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Empty when no key is configured — token service must handle this. */
  tokenEncryptionKey: string;
}

/** True when the minimum Canva Connect credentials (client id + secret) are present. */
export function isCanvaConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.CANVA_CLIENT_ID && env.CANVA_CLIENT_SECRET);
}

/** Canva config; throws a clear, value-free error listing what's missing. */
export function getCanvaConfig(): CanvaConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.CANVA_CLIENT_ID) missing.push('CANVA_CLIENT_ID');
  if (!env.CANVA_CLIENT_SECRET) missing.push('CANVA_CLIENT_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Canva is not configured. Missing: ${missing.join(', ')}. Set these in .env.local (see .env.example).`,
    );
  }
  return {
    clientId: env.CANVA_CLIENT_ID,
    clientSecret: env.CANVA_CLIENT_SECRET,
    redirectUri: env.CANVA_REDIRECT_URI,
    scopes: env.CANVA_SCOPES,
    apiBaseUrl: env.CANVA_API_BASE_URL,
    authorizeUrl: env.CANVA_OAUTH_AUTHORIZE_URL,
    tokenUrl: env.CANVA_OAUTH_TOKEN_URL,
    tokenEncryptionKey: env.CANVA_TOKEN_ENCRYPTION_KEY,
  };
}

export interface ZohoSocialConfig {
  clientId: string;
  clientSecret: string;
  orgId: string;
  dc: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  /** OAuth authorization endpoint */
  authorizeUrl: string;
  /** OAuth token endpoint */
  tokenUrl: string;
  /** REST API base */
  apiBaseUrl: string;
}

/** True when the minimum Zoho Social credentials are present. */
export function isZohoSocialConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.ZOHO_SOCIAL_CLIENT_ID && env.ZOHO_SOCIAL_CLIENT_SECRET && env.ZOHO_SOCIAL_ORG_ID);
}

/** Zoho Social config; throws a clear error listing what's missing. */
export function getZohoSocialConfig(): ZohoSocialConfig {
  const env = getServerEnv();
  const missing: string[] = [];
  if (!env.ZOHO_SOCIAL_CLIENT_ID) missing.push('ZOHO_SOCIAL_CLIENT_ID');
  if (!env.ZOHO_SOCIAL_CLIENT_SECRET) missing.push('ZOHO_SOCIAL_CLIENT_SECRET');
  if (!env.ZOHO_SOCIAL_ORG_ID) missing.push('ZOHO_SOCIAL_ORG_ID');
  if (missing.length > 0) {
    throw new Error(
      `Zoho Social is not configured. Missing: ${missing.join(', ')}. Set these in .env.local (see .env.example).`,
    );
  }
  const dc = env.ZOHO_SOCIAL_DC;
  return {
    clientId: env.ZOHO_SOCIAL_CLIENT_ID,
    clientSecret: env.ZOHO_SOCIAL_CLIENT_SECRET,
    orgId: env.ZOHO_SOCIAL_ORG_ID,
    dc,
    redirectUri: env.ZOHO_SOCIAL_REDIRECT_URI,
    tokenEncryptionKey: env.ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY,
    authorizeUrl: `https://accounts.zoho.${dc}/oauth/v2/auth`,
    tokenUrl: `https://accounts.zoho.${dc}/oauth/v2/token`,
    apiBaseUrl: `https://www.zohoapis.${dc}/social/v2`,
  };
}

/** Value-free snapshot of configuration state, safe to log or expose. */
export function describeConfigState() {
  const env = getServerEnv();
  return {
    appName: env.APP_NAME,
    nodeEnv: env.NODE_ENV,
    mssql: {
      auth: env.MSSQL_AUTH,
      server: env.MSSQL_SERVER,
      database: env.MSSQL_DATABASE,
      instance: env.MSSQL_INSTANCE || null,
      port: env.MSSQL_INSTANCE ? null : env.MSSQL_PORT,
      hasCredentials:
        env.MSSQL_AUTH === 'windows' ? true : Boolean(env.MSSQL_USER && env.MSSQL_PASSWORD),
    },
    googleAds: {
      authMode: env.GOOGLE_ADS_AUTH,
      configured: isGoogleAdsConfigured(),
      apiVersion: env.GOOGLE_ADS_API_VERSION,
      usesManagerAccount: Boolean(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
    },
    ai: {
      enabled: env.AI_ENABLED,
      configured: isAiConfigured(),
      provider: env.AI_PROVIDER,
      model: env.OPENAI_MODEL,
    },
    metaAds: {
      configured: isMetaAdsConfigured(),
      apiVersion: env.META_API_VERSION,
      hasAdAccountId: Boolean(env.META_AD_ACCOUNT_ID),
    },
    email: {
      configured: isEmailConfigured(),
      fromEmail: env.SENDGRID_FROM_EMAIL || null,
    },
    canva: {
      configured: isCanvaConfigured(),
      redirectUri: env.CANVA_REDIRECT_URI,
      scopes: env.CANVA_SCOPES,
      apiBaseUrl: env.CANVA_API_BASE_URL,
      hasEncryptionKey: env.CANVA_TOKEN_ENCRYPTION_KEY.length >= 16,
    },
    zohoSocial: {
      configured: isZohoSocialConfigured(),
      dc: env.ZOHO_SOCIAL_DC,
      redirectUri: env.ZOHO_SOCIAL_REDIRECT_URI,
      hasEncryptionKey: (env.ZOHO_SOCIAL_TOKEN_ENCRYPTION_KEY ?? '').length >= 16,
    },
  };
}

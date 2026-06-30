import { GoogleAdsApi } from 'google-ads-api';
import { getGoogleAdsConfig } from '../../server/config/env';

/** Customer ids must be digits only (no dashes) for the API. */
export function normaliseCustomerId(id: string): string {
  return id.replace(/[^0-9]/g, '');
}

/**
 * Builds a Google Ads `Customer` handle from validated env config. The return
 * type is inferred from the library so we do not couple to its exported type
 * names (which vary between versions).
 */
export function createGoogleAdsCustomer() {
  const cfg = getGoogleAdsConfig();
  const client = new GoogleAdsApi({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    developer_token: cfg.developerToken,
  });
  return client.Customer({
    customer_id: normaliseCustomerId(cfg.customerId),
    refresh_token: cfg.refreshToken,
    login_customer_id: cfg.loginCustomerId
      ? normaliseCustomerId(cfg.loginCustomerId)
      : undefined,
  });
}

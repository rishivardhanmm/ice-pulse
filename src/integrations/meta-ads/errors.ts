import { MetaApiException } from './client';

/** Convert any error from the Meta API or connector into a human-readable string. */
export function friendlyMetaError(err: unknown): string {
  if (err instanceof MetaApiException) {
    switch (err.code) {
      case 100:
        return `Meta API: Invalid parameter — check your Ad Account ID and API version. (${err.message})`;
      case 190:
        return `Meta API: Access token is invalid or expired. Generate a new System User token with ads_read permission.`;
      case 200:
      case 210:
        return `Meta API: Permission denied. Ensure the System User has ads_read access to this Ad Account.`;
      case 4:
      case 17:
        return `Meta API: Rate limit reached. The sync will succeed if retried shortly.`;
      default:
        return `Meta API error (code ${err.code}): ${err.message}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

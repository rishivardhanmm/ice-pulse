import type { CanvaCapabilityDTO } from '@/lib/types';

/**
 * Design generation (create-design-from-brand-template + Autofill).
 *
 * Intentionally a thin, capability-gated placeholder: the Autofill and brand
 * template APIs require Canva Enterprise (the `autofill` / `brand_template`
 * capabilities). We do NOT implement generation until the connected account
 * actually reports the capability and the official flow is confirmed — see
 * docs/canva-integration.md. Asset upload is also kept here for the future.
 */

export interface GenerationAvailability {
  autofillAvailable: boolean;
  brandTemplatesAvailable: boolean;
  message: string;
}

const AUTOFILL_UNAVAILABLE_MESSAGE =
  'Canva Autofill is not available for this connected account. We can still keep the Canva ' +
  'connection and use supported features such as template sync, asset upload, or exports if ' +
  'available. Full template autofill may require Canva Enterprise or Canva-approved access.';

/** Derive whether report generation (autofill) can run for this connection. */
export function describeGenerationAvailability(
  capabilities: CanvaCapabilityDTO[],
): GenerationAvailability {
  const has = (name: string) => capabilities.some((c) => c.name === name && c.available);
  const autofillAvailable = has('autofill');
  const brandTemplatesAvailable = has('brand_template');
  return {
    autofillAvailable,
    brandTemplatesAvailable,
    message: autofillAvailable
      ? 'Autofill is available — report generation can be implemented for this account.'
      : AUTOFILL_UNAVAILABLE_MESSAGE,
  };
}

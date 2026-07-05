import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { isAiConfigured, isEmailConfigured } from '@/server/config/env';
import { sendWeeklyDigest } from '@/server/services/digest.service';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manually trigger the weekly AI digest email (admin only) — e.g. to preview it. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }
  if (!isEmailConfigured()) {
    return jsonError('Email is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL in .env.local.', 400);
  }

  try {
    const result = await sendWeeklyDigest(7);
    return jsonOk({ sent: true, recipients: result.recipients });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}

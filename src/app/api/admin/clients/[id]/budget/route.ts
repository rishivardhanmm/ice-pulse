import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { getClientBudget, upsertClientBudget } from '@/server/db/repositories/budgets.repo';

export const dynamic = 'force-dynamic';

/** GET /api/admin/clients/[id]/budget — fetch current budget % for a client */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
      return jsonError('Forbidden', 403);
    }
    const clientId = parseInt(params.id, 10);
    if (!Number.isFinite(clientId)) return jsonError('Invalid client id', 400);

    const budget = await getClientBudget(clientId);
    return jsonOk(budget ?? null);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}

/** PUT /api/admin/clients/[id]/budget — set budget % for a client */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
      return jsonError('Forbidden', 403);
    }
    const clientId = parseInt(params.id, 10);
    if (!Number.isFinite(clientId)) return jsonError('Invalid client id', 400);

    const body = (await req.json().catch(() => null)) as {
      pctUsed?: unknown;
      notes?: unknown;
      monthlyBudget?: unknown;
      monthlyConversionGoal?: unknown;
    } | null;
    const pctUsed = typeof body?.pctUsed === 'number' ? Math.round(body.pctUsed) : NaN;
    if (isNaN(pctUsed) || pctUsed < 0 || pctUsed > 100) {
      return jsonError('pctUsed must be an integer 0–100', 400);
    }
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;
    // Optional real budget amount — enables computed pacing on the client page.
    const monthlyBudget =
      typeof body?.monthlyBudget === 'number' && body.monthlyBudget > 0
        ? Math.round(body.monthlyBudget * 100) / 100
        : null;
    // Optional conversion goal — enables goal progress on the client page.
    const monthlyConversionGoal =
      typeof body?.monthlyConversionGoal === 'number' && body.monthlyConversionGoal > 0
        ? Math.round(body.monthlyConversionGoal * 100) / 100
        : null;

    await upsertClientBudget(
      clientId,
      pctUsed,
      notes,
      session.user.id ? Number(session.user.id) : null,
      monthlyBudget,
      monthlyConversionGoal,
    );
    return jsonOk({ ok: true, pctUsed, monthlyBudget, monthlyConversionGoal });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}

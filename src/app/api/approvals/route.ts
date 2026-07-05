import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { listForViewer, submitContent } from '@/server/services/approvals.service';
import { saveUploadedImage, UploadError } from '@/server/services/upload.service';
import type { ApprovalStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const sp = new URL(req.url).searchParams;
  const statusParam = sp.get('status');
  const status = VALID_STATUSES.includes(statusParam as ApprovalStatus)
    ? (statusParam as ApprovalStatus)
    : undefined;
  const mine = sp.get('mine') === '1';

  const submissions = await listForViewer({ status, mine }, Number(session.user.id));
  return jsonOk({ submissions });
}

/** Submit a new content image for approval. Multipart form: clientId, campaignId?, title, caption, image. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  try {
    const form = await req.formData();
    const clientIdRaw = form.get('clientId');
    const campaignIdRaw = form.get('campaignId');
    const title = form.get('title');
    const caption = form.get('caption');
    const image = form.get('image');

    if (!(image instanceof File)) return jsonError('image file is required.', 400);

    const clientId = typeof clientIdRaw === 'string' && clientIdRaw ? parseInt(clientIdRaw, 10) : null;
    const campaignId = typeof campaignIdRaw === 'string' && campaignIdRaw ? parseInt(campaignIdRaw, 10) : null;

    const imagePath = await saveUploadedImage(image);

    const reviewerIdsRaw = form.get('reviewerIds');
    const reviewerIds =
      typeof reviewerIdsRaw === 'string' && reviewerIdsRaw.trim()
        ? reviewerIdsRaw
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter(Number.isFinite)
        : [];

    const id = await submitContent({
      clientId: Number.isFinite(clientId as number) ? clientId : null,
      campaignId: Number.isFinite(campaignId as number) ? campaignId : null,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null,
      caption: typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 2000) : null,
      imagePath,
      submittedBy: Number(session.user.id),
      reviewerIds,
    });

    return jsonOk({ id });
  } catch (err) {
    if (err instanceof UploadError) return jsonError(err.message, 400);
    return jsonError(toErrorMessage(err), 500);
  }
}

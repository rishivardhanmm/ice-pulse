import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import { resubmit, ApprovalError } from '@/server/services/approvals.service';
import { saveUploadedImage, UploadError } from '@/server/services/upload.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Multipart form: image? (optional replacement), title?, caption? */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'internal')) {
    return jsonError('Forbidden', 403);
  }

  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return jsonError('Invalid submission id', 400);

  try {
    const form = await req.formData();
    const image = form.get('image');
    const title = form.get('title');
    const caption = form.get('caption');

    const imagePath = image instanceof File && image.size > 0 ? await saveUploadedImage(image) : null;

    await resubmit(id, Number(session.user.id), {
      imagePath,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : null,
      caption: typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 2000) : null,
    });

    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof ApprovalError) return jsonError(err.message, err.status);
    if (err instanceof UploadError) return jsonError(err.message, 400);
    return jsonError(toErrorMessage(err), 500);
  }
}

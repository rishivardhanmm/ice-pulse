import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { jsonOk, jsonError } from '@/server/api/http';
import { generatePostDraft } from '@/server/services/zoho-social.service';
import { isAiConfigured } from '@/server/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CreatePostBody {
  topic: string;
  networks?: string[];
  tone?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonError('Unauthorised', 401);
  if (session.user.role !== 'admin' && session.user.role !== 'internal') {
    return jsonError('Forbidden', 403);
  }
  if (!isAiConfigured()) {
    return jsonError('AI is not configured.', 503);
  }

  let body: CreatePostBody;
  try {
    body = (await req.json()) as CreatePostBody;
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  if (!body.topic?.trim()) {
    return jsonError('topic is required.', 400);
  }

  try {
    const draft = await generatePostDraft({
      topic: body.topic.trim(),
      networks: body.networks ?? ['instagram', 'facebook', 'linkedin'],
      tone: body.tone,
    });
    return jsonOk(draft);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Post generation failed.', 500);
  }
}


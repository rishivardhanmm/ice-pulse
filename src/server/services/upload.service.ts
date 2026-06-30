import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB — safely under typical IIS defaults
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export class UploadError extends Error {}

/**
 * Saves an uploaded image to public/uploads/approvals/{yyyy}/{mm}/{uuid}.{ext} and
 * returns the public URL path to store in the DB. Filenames are always
 * server-generated (never derived from user input) to avoid path traversal.
 */
export async function saveUploadedImage(file: File): Promise<string> {
  if (!file || file.size === 0) throw new UploadError('No file provided.');
  if (file.size > MAX_BYTES) {
    throw new UploadError(`Image is too large (max ${MAX_BYTES / (1024 * 1024)}MB).`);
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    throw new UploadError('Unsupported image type. Use JPEG, PNG, WebP or GIF.');
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const filename = `${randomUUID()}.${ext}`;

  const dir = path.join(process.cwd(), 'public', 'uploads', 'approvals', yyyy, mm);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return `/uploads/approvals/${yyyy}/${mm}/${filename}`;
}

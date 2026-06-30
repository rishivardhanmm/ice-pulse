import { getCampaignList } from '@/server/services/dashboard.service';
import { jsonOk, jsonError, parseDateRange } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';
import type { CampaignSortKey } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORT_KEYS: CampaignSortKey[] = [
  'spend',
  'clicks',
  'impressions',
  'ctr',
  'conversions',
  'name',
];

function parseSort(value: string | null): CampaignSortKey {
  return value && (SORT_KEYS as string[]).includes(value)
    ? (value as CampaignSortKey)
    : 'spend';
}

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { from, to } = parseDateRange(sp);
    const data = await getCampaignList({
      from,
      to,
      sort: parseSort(sp.get('sort')),
      direction: sp.get('direction') === 'asc' ? 'asc' : 'desc',
      status: sp.get('status') || undefined,
      channelType: sp.get('channel') || sp.get('channelType') || undefined,
      search: sp.get('search') || sp.get('q') || undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}

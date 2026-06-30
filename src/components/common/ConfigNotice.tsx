import Link from 'next/link';

export function ConfigNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4"
      style={{ background: 'var(--status-paused-bg)', border: '1px solid var(--ai-border)' }}
    >
      <i className="bi bi-info-circle-fill mt-0.5 text-base" style={{ color: 'var(--orange)' }} aria-hidden="true" />
      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Google Ads isn&apos;t configured yet.</strong>{' '}
        Add your credentials to <code>.env.local</code> (see <code>.env.example</code>), run{' '}
        <code>npm run db:migrate</code>, then sync from the{' '}
        <Link href="/sync" style={{ color: 'var(--gold)' }}>
          Sync Centre
        </Link>
        .
      </div>
    </div>
  );
}

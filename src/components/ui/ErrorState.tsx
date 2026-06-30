export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--status-removed-bg)', color: 'var(--red)' }}
      >
        <i className="bi bi-exclamation-triangle-fill text-xl" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Something went wrong
      </h3>
      <p className="max-w-md text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="ice-pill-btn-ghost mt-1" type="button">
          <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
}

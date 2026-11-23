export function AccountListStatus({ loading, error, count, more, refresh }: {
  loading: boolean; error: string; count: number; more?: () => Promise<void>; refresh: () => Promise<void>;
}) {
  return <div className="account-list-status" aria-live="polite">
    {error ? <><p className="form-error" role="alert">{error}</p><button className="text-button" onClick={() => void refresh()}>Try again</button></>
      : <span>{loading ? "Loading…" : `${count} records shown`}</span>}
    {more && <button className="button secondary" disabled={loading} onClick={() => void more()}>Load more</button>}
  </div>;
}

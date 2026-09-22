'use client';
import { useEffect, useState } from 'react';
import type { claimPortalState } from '@/server/claim-links';
type State = Awaited<ReturnType<typeof claimPortalState>>;
export default function ClaimPortal() {
  const [state, setState] = useState<State | null>(null),
    [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [title, setTitle] = useState(''),
    [sent, setSent] = useState(false);
  async function refresh() {
    const r = await fetch('/api/claim-link');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setState(data);
    setTitle((current) => current || data.title);
  }
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (value) {
      setToken(value);
      history.replaceState(null, '', '/claim');
    } else void refresh().catch((e) => setError(e.message));
  }, []);
  async function post(input: object | FormData) {
    const r = await fetch(
      '/api/claim-link',
      input instanceof FormData
        ? { method: 'POST', body: input }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          },
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }
  const format = (n: number) =>
    new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: state?.currency || 'MYR',
    }).format(n / 100);
  return (
    <main style={{ maxWidth: 780, margin: '40px auto', padding: 24 }}>
      <section className="panel" style={{ padding: 24 }}>
        <h1>Employee claim</h1>
        <p>Upload receipts for your claim. This link only gives access to this claim.</p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {token && !state && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await post({ action: 'redeem', token });
                setToken('');
                await refresh();
              })
            }
          >
            Open my one-time claim link
          </button>
        )}
        {state && (
          <>
            <h2>{state.employee} claim</h2>
            <p>
              {state.month} · {state.status}
            </p>
            <label>
              Claim description
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy || sent || !['Draft', 'Needs Review'].includes(state.status)}
              />
            </label>
            <h3>Total receipts: {format(state.total)}</h3>
            <ul>
              {state.files.map((f) => (
                <li key={f.id}>
                  {f.name} — {f.status}
                </li>
              ))}
            </ul>
            <ul>
              {state.receipts.map((r) => (
                <li key={r.id}>
                  {r.party || 'Merchant needs review'} · {r.currency || '?'}{' '}
                  {((r.totalMinor || 0) / 100).toFixed(2)} · {r.invoiceDate || 'Date needs review'}
                </li>
              ))}
            </ul>
            {!sent && ['Draft', 'Needs Review'].includes(state.status) && (
              <>
                <label>
                  Add receipt files
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    disabled={busy}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      void run(async () => {
                        for (const file of files) {
                          const form = new FormData();
                          form.set('file', file);
                          await post(form);
                          await post({ action: 'process' });
                        }
                        await refresh();
                      });
                    }}
                  />
                </label>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      for (const file of state.files.filter((f) => f.status === 'queued')) {
                        await post({ action: 'process' });
                      }
                      await refresh();
                    })
                  }
                >
                  Calculate receipts
                </button>
                <button
                  className="button primary"
                  disabled={
                    busy || !state.files.length || state.files.some((f) => f.status !== 'complete')
                  }
                  onClick={() =>
                    void run(async () => {
                      await post({ action: 'details', title });
                      await post({ action: 'submit' });
                      setSent(true);
                    })
                  }
                >
                  Submit claim
                </button>
              </>
            )}
            {busy && <p role="status">Working… please keep this page open.</p>}
            {sent && <p role="status">Claim sent for review. Your receipts have been saved.</p>}
          </>
        )}
      </section>
    </main>
  );
}

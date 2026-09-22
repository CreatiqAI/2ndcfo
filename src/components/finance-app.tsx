'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  Wallet,
  X,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { snapshot } from '@/server/workspace';
import { PdfPreview } from './pdf-preview';
import { DocumentCalendar } from './document-calendar';
import { monthLabel } from '@/lib/document-months';
type Json<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
type State = Json<Awaited<ReturnType<typeof snapshot>>>;
type Invoice = State['invoices'][number];
function invoiceReviewReason(i: Invoice) {
  const reasons: string[] = [];
  if (i.duplicateOf) reasons.push(i.duplicateReason || 'Possible duplicate document');
  const missing = [
    !i.party && 'supplier / customer',
    !i.invoiceDate && 'invoice date',
    (i.totalMinor == null || i.totalMinor <= 0) && 'valid total',
    !i.currency && 'currency',
    !i.category && 'category',
  ].filter(Boolean);
  if (missing.length) reasons.push(`Missing ${missing.join(', ')}`);
  if (i.kind === 'Other Financial Document') reasons.push('Document type needs classification');
  if (
    i.subtotalMinor != null &&
    i.taxMinor != null &&
    i.totalMinor != null &&
    i.subtotalMinor + i.taxMinor !== i.totalMinor
  )
    reasons.push('Subtotal + tax does not equal total');
  if (i.confidence < 80)
    reasons.push(`AI confidence ${i.confidence}% — below 80% review threshold`);
  return reasons.length ? reasons.join('; ') : 'Awaiting manual verification and approval';
}
type Claim = State['claims'][number];
type Statement = State['statements'][number];
type Session = {
  user: { id: string; name: string; email: string };
  workspaces: { id: string; name: string; currency: string; role: string }[];
  state: State;
};
const nav = [
  ['Dashboard', LayoutDashboard],
  ['Money In', ArrowDownLeft],
  ['Money Out', ArrowUpRight],
  ['Claims', Receipt],
  ['Bank Matching', ArrowLeftRight],
  ['Transactions', ClipboardCheck],
  ['Budget', Target],
  ['Reports', BarChart3],
  ['AI Finance', Sparkles],
  ['Documents', FolderOpen],
  ['Deleted records', Trash2],
  ['Settings', Settings2],
] as const;
const money = (amount: number | null | undefined, currency = 'MYR') =>
  amount == null
    ? 'Unknown'
    : new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
      }).format(amount / 100);
const dec = (v: number | null | undefined) => (v == null ? '' : (v / 100).toFixed(2));
const todayMonth = () => new Date().toISOString().slice(0, 7);
const dateLabel = (v: string | null) =>
  v
    ? new Date(v + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Missing date';
function Badge({ children }: { children: ReactNode }) {
  const t = String(children);
  return (
    <span
      className={`badge ${/Approved|Paid|Matched|Imported|complete|Ready|Categorised/.test(t) && !/^Un|Partial/.test(t) ? 'green' : /Review|Partial|Overdue|Duplicate|failed|Missing/.test(t) ? 'amber' : /Rejected/.test(t) ? 'red' : 'gray'}`}
    >
      {children}
    </span>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <FolderOpen size={30} />
      <h3>{title}</h3>
      <p>{children || 'Your records will appear here as you work.'}</p>
    </div>
  );
}
function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function BrandMark() {
  return (
    <img
      className="brand-logo"
      src="/creatiq-ai-logo.jpeg"
      alt="Creatiq AI"
      width={48}
      height={48}
    />
  );
}
function GoogleButton({
  link = false,
  notify,
}: {
  link?: boolean;
  notify: (text: string, error?: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      className="button secondary full google-button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          window.location.assign(data.url);
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Unable to start Google sign-in.', true);
          setPending(false);
        }
      }}
    >
      {pending ? (
        <LoaderCircle size={18} className="spin" />
      ) : (
        <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 700, color: '#4285f4' }}>
          G
        </span>
      )}
      {link ? 'Link Google account' : 'Continue with Google'}
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={wide ? 'modal wide' : 'modal'}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function FinanceApp() {
  const [trashTarget, setTrashTarget] = useState<{
    id: string;
    type: 'invoice' | 'claim';
    name: string;
  } | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState('Dashboard'),
    [companyId, setCompanyId] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('All'),
    [month, setMonth] = useState(todayMonth()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(null),
    [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<string | null>(null),
    [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null),
    [selectedClaim, setSelectedClaim] = useState<Claim | null>(null),
    [selectedStatement, setSelectedStatement] = useState<Statement | null>(null);
  const state = session?.state;
  const refresh = useCallback(async (id?: string) => {
    const r = await fetch(`/api/state${id ? '?company=' + id : ''}`, { cache: 'no-store' });
    if (r.status === 401) {
      setSession(null);
      setLoading(false);
      return;
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setSession(data);
    setCompanyId(data.state?.company.id || '');
    setLoading(false);
    return data as Session;
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has('auth_error'))
      setMessage({ text: query.get('auth_error')!.slice(0, 300), error: true });
    if (query.get('google') === 'success')
      setMessage({ text: 'Google sign-in successful.', error: false });
    if (query.has('auth_error') || query.has('google'))
      window.history.replaceState(null, '', window.location.pathname);
    refresh().catch((e) => {
      setMessage({ text: e.message, error: true });
      setLoading(false);
    });
  }, [refresh]);
  useEffect(() => {
    if (!message || message.error) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);
  const notify = (text: string, error = false) => setMessage({ text, error });
  const action = async (
    action: string,
    input: Record<string, unknown> = {},
    success = 'Changes saved.',
  ) => {
    setBusy(true);
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, companyId, ...input }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      await refresh(companyId);
      notify(success);
      return data;
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Something went wrong.', true);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const run = (fn: () => Promise<unknown>) => {
    void fn().catch(() => {});
  };
  const pendingCount =
    state?.jobs.filter((j) => ['queued', 'processing'].includes(j.status)).length || 0;
  useEffect(() => {
    if (!companyId || !pendingCount) return;
    let cancelled = false;
    const tick = async () => {
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'jobs.process', companyId }),
        });
        if (!cancelled) await refresh(companyId);
      } catch {
        /* Durable jobs remain visible and retryable. */
      }
      if (!cancelled) timer = setTimeout(tick, 1500);
    };
    let timer = setTimeout(tick, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, pendingCount, refresh]);
  const navigate = (next: string) => {
    setPage(next);
    setFilter('All');
    setSearch('');
    setMobile(false);
  };
  const close = () => {
    setModal(null);
    setSelectedInvoice(null);
    setSelectedStatement(null);
  };
  if (loading)
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          <BrandMark />
        </div>
        <LoaderCircle className="spin" />
        <p>Opening your finance workspace…</p>
      </main>
    );
  if (!session || !state)
    return <Login onComplete={() => refresh()} notify={notify} message={message} />;
  const full = ['Admin', 'Finance', 'Accountant'].includes(state.actor.role),
    canEdit = ['Admin', 'Finance'].includes(state.actor.role);
  const needReview = state.invoices.filter(
    (i) => !i.claimId && ['Needs Review', 'Ready'].includes(i.reviewStatus),
  );
  const monthlyReview = needReview.filter((i) => !i.invoiceDate || i.invoiceDate.startsWith(month));
  const monthlyBank = state.bank.filter((b) => b.date.startsWith(month));
  const matchedBank = monthlyBank.filter((b) => b.status === 'Matched').length;
  const openClaims = state.claims.filter(
    (c) => c.month === month && !['Finance Approved', 'Rejected'].includes(c.status),
  );
  const reviewQueue = [...monthlyReview].sort(
    (a, b) => Number(!!b.duplicateOf) - Number(!!a.duplicateOf),
  );
  const exportLink = (kind: string) => `/api/export?company=${companyId}&kind=${kind}`;
  const docLink = (id: string, start?: number, end?: number) =>
    `/api/documents/${id}?company=${companyId}${start ? '&start=' + start + '&end=' + end : ''}`;
  const matches = (x: unknown) =>
    !search || JSON.stringify(x).toLowerCase().includes(search.toLowerCase());
  const selectInvoice = (i: Invoice) => {
    setSelectedInvoice(i);
    setModal('invoice');
  };
  const moneyRows = state.invoices.filter(
    (i) =>
      !i.claimId &&
      !i.deleted &&
      matches(i) &&
      (page === 'Transactions'
        ? i.reviewStatus === 'Approved'
        : page === 'Money In'
          ? i.kind === 'Sales Invoice'
          : i.kind !== 'Sales Invoice') &&
      (filter === 'All' ||
        (filter === 'Overdue' ? i.isOverdue : i.paymentStatus === filter) ||
        i.reviewStatus === filter),
  );
  const claimBundles = () => (
    <section className="panel">
      <div className="section-heading">
        <h2>Employee claim bundles</h2>
        <p>Receipts stay together. Only finance-approved claims enter payment totals.</p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Month</th>
              <th>Receipts</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.claims
              .filter(
                (c) =>
                  !c.deleted &&
                  matches(c) &&
                  (filter === 'All' ||
                    c.status === filter ||
                    c.paymentStatus === filter ||
                    (filter === 'Draft' &&
                      c.status !== 'Finance Approved' &&
                      c.status !== 'Rejected')),
              )
              .map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.employeeName} claim</b>
                    <small>{c.title}</small>
                  </td>
                  <td>{c.month}</td>
                  <td>{c.receiptCount}</td>
                  <td>{money(c.claimedMinor, c.currency)}</td>
                  <td>
                    <Badge>{c.paymentStatus}</Badge>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelectedClaim(c);
                        setModal('claim');
                      }}
                    >
                      Open receipts <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
  const invoiceTable = (rows: Invoice[], review = false) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Supplier / customer</th>
            <th>Invoice</th>
            <th>Amount</th>
            <th>Category</th>
            {review && <th>Confidence</th>}
            <th>Status</th>
            <th>Bank match</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <div className="party">
                  <span className={`avatar ${i.kind === 'Sales Invoice' ? 'mint' : 'violet'}`}>
                    {(i.party || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <b>{i.party || 'Unknown party'}</b>
                    <small>{i.description || i.documentName}</small>
                  </div>
                </div>
              </td>
              <td>
                <b className="number-text">{i.number || 'Missing number'}</b>
                <small>{dateLabel(i.invoiceDate)}</small>
              </td>
              <td className="amount">
                {money(i.totalMinor, i.currency || state.company.currency)}
                {i.paidMinor > 0 && i.outstandingMinor > 0 && (
                  <small>{money(i.outstandingMinor, i.currency!)} remaining</small>
                )}
              </td>
              <td>{i.category || <span className="muted">Unknown</span>}</td>
              {review && (
                <td>
                  <div className="confidence">
                    <span>{i.confidence}%</span>
                    <i style={{ width: `${i.confidence}%` }} />
                  </div>
                </td>
              )}
              <td>
                <div className="invoice-review-status">
                  <Badge>
                    {i.duplicateOf && i.reviewStatus !== 'Approved'
                      ? 'Duplicate'
                      : i.reviewStatus === 'Approved'
                        ? i.paymentStatus
                        : i.reviewStatus}
                  </Badge>
                  {i.reviewStatus === 'Needs Review' && (
                    <span className="invoice-review-reason">{invoiceReviewReason(i)}</span>
                  )}
                  {i.isOverdue && (
                    <span className="invoice-review-reason">
                      Due {dateLabel(i.effectiveDueDate)} · {money(i.outstandingMinor, i.currency!)}{' '}
                      still awaiting payment matching.
                    </span>
                  )}
                  {i.dueDateSource === 'terms' && (
                    <span className="invoice-review-reason">
                      Due {dateLabel(i.effectiveDueDate)} calculated from invoice date +{' '}
                      {i.paymentTerms}.
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className={'match-state ' + (i.bankMatch === 'Matched' ? 'matched' : '')}>
                  {i.bankMatch === 'Matched' ? (
                    <CheckCheck size={14} />
                  ) : (
                    <span className="status-dot" />
                  )}
                  {i.bankMatch}
                </span>
              </td>
              <td>
                <button className="text-button" onClick={() => selectInvoice(i)}>
                  {i.reviewStatus === 'Approved' ? 'View' : 'Review'}
                  <ArrowRight size={14} />
                </button>
                {canEdit && !i.claimId && (
                  <button
                    className="text-button"
                    onClick={() =>
                      setTrashTarget({
                        id: i.id,
                        type: 'invoice',
                        name: i.number || i.party || 'invoice',
                      })
                    }
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty title="No invoices here yet">
          Upload documents to begin, or try a different filter.
        </Empty>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobile ? 'open' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setMobile(false);
        }}
      >
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('Dashboard');
          }}
        >
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            2nd<span className="brand-light">CFO</span>
            <small>POWERED BY CREATIQ AI</small>
          </span>
        </a>
        <div className="workspace-picker">
          <Building2 size={18} />
          <select
            aria-label="Company workspace"
            value={companyId}
            onChange={(e) => run(() => refresh(e.target.value))}
          >
            {session.workspaces.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav
            .filter(([label]) => label !== 'Deleted records' || canEdit)
            .map(([label, Icon]) => (
              <button
                key={label}
                className={page === label ? 'active' : ''}
                aria-current={page === label ? 'page' : undefined}
                onClick={() => navigate(label)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {label === 'Documents' && needReview.length > 0 && <em>{needReview.length}</em>}
                {['Budget', 'Reports', 'AI Finance'].includes(label) && (
                  <span className="soon-label">Soon</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trust-note">
            <ShieldCheck size={18} />
            <div>
              <b>Your records, protected</b>
              <span>Every approval leaves a trail.</span>
            </div>
          </div>
          <div className="user-profile">
            <span className="avatar mint">{session.user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <b>{session.user.name}</b>
              <small>{state.actor.role}</small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() =>
                run(async () => {
                  await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'logout' }),
                  });
                  setSession(null);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle navigation"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className="status-dot" />
              {state.local ? 'Local workspace' : 'Company workspace'}
            </span>
            <button className="icon-button" aria-label="Help" onClick={() => setModal('help')}>
              <CircleHelp size={20} />
            </button>
            <span className="avatar small mint">{session.user.name.charAt(0)}</span>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'Dashboard'
                  ? 'YOUR FINANCES, IN FOCUS'
                  : page === 'Bank Matching'
                    ? 'MAKE EVERY TRANSACTION COUNT'
                    : 'FINANCE WORKSPACE'}
              </div>
              <h1>
                {page === 'Dashboard' ? `Welcome back, ${session.user.name.split(' ')[0]}.` : page}
              </h1>
              <p>
                {(
                  {
                    Dashboard: 'A clear view of what’s done, what’s pending, and what needs you.',
                    'Money In': 'Review your sales invoices and keep track of customer payments.',
                    'Deleted records': 'Review deleted records and restore them to your workspace.',
                    'Money Out': 'Stay on top of supplier bills and business expenses.',
                    Claims: 'From receipt to reimbursement, with every approval recorded.',
                    'Bank Matching': 'Connect the documents to the money. You make the final call.',
                    Transactions: 'Your approved financial activity, with the evidence attached.',
                    Documents: 'One place for your originals, extractions, and reviews.',
                    Settings: 'Manage your workspace, people, and connected services.',
                  } as Record<string, string>
                )[page] || 'Part of your complete finance workspace.'}
              </p>
            </div>
            <div className="heading-actions">
              {['Dashboard', 'Bank Matching', 'Claims'].includes(page) && (
                <label className="month-control">
                  <Clock3 size={16} />
                  <input
                    aria-label="Selected month"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
              )}
              {canEdit && ['Dashboard', 'Documents', 'Money In', 'Money Out'].includes(page) && (
                <button
                  className="button primary"
                  onClick={() => {
                    setSelectedClaim(null);
                    setModal('upload');
                  }}
                >
                  <Plus size={17} />
                  Upload documents
                </button>
              )}
              {page === 'Claims' && state.actor.role !== 'Accountant' && (
                <button className="button primary" onClick={() => setModal('claim-create')}>
                  <Plus size={17} />
                  New claim
                </button>
              )}
              {page === 'Bank Matching' && canEdit && (
                <button className="button primary" onClick={() => setModal('statement-upload')}>
                  <UploadCloud size={17} />
                  Import statement
                </button>
              )}
            </div>
          </div>
          {message && (
            <div
              role={message.error ? 'alert' : 'status'}
              className={`toast-inline ${message.error ? 'error' : 'success'}`}
            >
              {message.error ? <AlertTriangle size={18} /> : <Check size={18} />}
              <span>{message.text}</span>
              <button
                className="icon-button"
                onClick={() => setMessage(null)}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="processing-banner">
              <LoaderCircle className="spin" size={16} />
              {pendingCount} document{pendingCount !== 1 ? 's' : ''} waiting for extraction. You can
              keep working.
            </div>
          )}
          {page === 'Dashboard' && (
            <div className="dashboard">
              <section className="dashboard-hero">
                <div>
                  <span className="hero-kicker">
                    <span /> YOUR MONTH AT A GLANCE
                  </span>
                  <h2>Less admin. More clarity.</h2>
                  <p>
                    Review your documents, keep claims moving, and match your bank activity — all in
                    one place.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button light"
                      onClick={() => {
                        navigate('Documents');
                        setFilter('Needs Review');
                      }}
                    >
                      <FileCheck2 size={18} /> Review documents <ArrowRight size={17} />
                    </button>
                    <span>AI suggests. You stay in control.</span>
                  </div>
                </div>
                <div className="hero-progress">
                  <div
                    className="progress-ring"
                    style={{
                      background:
                        'conic-gradient(var(--brand-blue) ' +
                        (monthlyBank.length ? (matchedBank / monthlyBank.length) * 100 : 0) +
                        '%, #ffffff20 0)',
                    }}
                  >
                    <div>
                      <strong>
                        {monthlyBank.length
                          ? Math.round((matchedBank / monthlyBank.length) * 100)
                          : 0}
                        %
                      </strong>
                      <small>matched</small>
                    </div>
                  </div>
                  <b>Bank matching</b>
                  <small>
                    {matchedBank} of {monthlyBank.length} bank items matched this month
                  </small>
                </div>
              </section>
              <div className="metrics dashboard-metrics">
                <Metric
                  label="Documents received"
                  value={state.documents.filter((d) => d.createdAt.slice(0, 7) === month).length}
                  note="Uploaded in the selected month"
                  icon={<FolderOpen size={20} />}
                />
                <Metric
                  label="Documents to review"
                  value={monthlyReview.length}
                  note="Includes documents with no date"
                  icon={<FileCheck2 size={20} />}
                />
                <Metric
                  label="Bank items to match"
                  value={monthlyBank.length - matchedBank}
                  note="Unmatched and partially resolved"
                  icon={<ArrowLeftRight size={20} />}
                />
                <Metric
                  label="Open claims"
                  value={openClaims.length}
                  note="Drafts and claims awaiting approval"
                  icon={<Receipt size={20} />}
                />
              </div>
              <section className="quick-actions" aria-label="Quick actions">
                {canEdit && (
                  <button
                    onClick={() => {
                      setSelectedClaim(null);
                      setModal('upload');
                    }}
                  >
                    <span>
                      <UploadCloud size={21} />
                    </span>
                    <div>
                      <b>Upload documents</b>
                      <small>Add invoices & receipts</small>
                    </div>
                    <Plus size={18} />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => setModal('statement-upload')}>
                    <span>
                      <ArrowLeftRight size={21} />
                    </span>
                    <div>
                      <b>Import statement</b>
                      <small>Bring in your bank activity</small>
                    </div>
                    <Plus size={18} />
                  </button>
                )}
                {state.actor.role !== 'Accountant' && (
                  <button onClick={() => setModal('claim-create')}>
                    <span>
                      <Receipt size={21} />
                    </span>
                    <div>
                      <b>Create a claim</b>
                      <small>Submit a reimbursement</small>
                    </div>
                    <Plus size={18} />
                  </button>
                )}
                {!canEdit && (
                  <button onClick={() => navigate('Documents')}>
                    <span>
                      <FolderOpen size={21} />
                    </span>
                    <div>
                      <b>Browse documents</b>
                      <small>Find your supporting records</small>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                )}
              </section>
              <div className="dashboard-columns">
                <section className="panel attention-list">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Needs your attention <span className="count">{reviewQueue.length}</span>
                      </h2>
                      <p>Selected month · possible duplicates shown first</p>
                    </div>
                    <button className="text-button" onClick={() => navigate('Documents')}>
                      View all <ArrowRight size={16} />
                    </button>
                  </div>
                  {reviewQueue.length ? (
                    reviewQueue.slice(0, 5).map((i) => (
                      <button className="attention-row" key={i.id} onClick={() => selectInvoice(i)}>
                        <span className={'review-icon ' + (i.duplicateOf ? 'warning' : '')}>
                          {i.duplicateOf ? <AlertTriangle size={21} /> : <FileText size={21} />}
                        </span>
                        <span className="attention-details">
                          <b>{i.party || 'Document needs details'}</b>
                          <small>
                            {i.duplicateOf
                              ? 'Possible duplicate · check before approving'
                              : i.reviewStatus === 'Ready'
                                ? 'Details ready for your approval'
                                : 'Check missing or uncertain details'}
                          </small>
                          <span className="review-reference">
                            {i.number || 'No invoice number'} · {dateLabel(i.invoiceDate)}
                          </span>
                        </span>
                        <span className="attention-amount">
                          <b>{money(i.totalMinor, i.currency || state.company.currency)}</b>
                          <small>
                            Review <ArrowRight size={14} />
                          </small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <Empty title="Your review queue is clear">
                      No documents need review for this month. You can upload more documents or
                      continue matching bank activity.
                    </Empty>
                  )}
                </section>
                <section className="panel next-tasks">
                  <div className="section-heading">
                    <div>
                      <h2>Keep things moving</h2>
                      <p>Your next steps for this month</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('Bank Matching')}>
                    <span className="task-icon">
                      <ArrowLeftRight size={20} />
                    </span>
                    <div>
                      <b>Match bank activity</b>
                      <small>{monthlyBank.length - matchedBank} items still to resolve</small>
                    </div>
                    <ArrowRight size={17} />
                  </button>
                  <button onClick={() => navigate('Claims')}>
                    <span className="task-icon orange">
                      <Receipt size={20} />
                    </span>
                    <div>
                      <b>Follow up on claims</b>
                      <small>{openClaims.length} open claims this month</small>
                    </div>
                    <ArrowRight size={17} />
                  </button>
                  <button onClick={() => navigate('Documents')}>
                    <span className="task-icon">
                      <FolderOpen size={20} />
                    </span>
                    <div>
                      <b>Find a document</b>
                      <small>Browse originals and review details</small>
                    </div>
                    <ArrowRight size={17} />
                  </button>
                  <div className="dashboard-tip">
                    <ShieldCheck size={20} />
                    <p>
                      <b>A clear trail, always.</b> Every approval is recorded alongside its
                      supporting document.
                    </p>
                  </div>
                </section>
              </div>
              <p className="dashboard-scope">
                <Clock3 size={16} /> This overview tracks your document and payment workflow.
                Financial analytics, budgets and reports are coming next.
              </p>
            </div>
          )}
          {['Money In', 'Money Out', 'Transactions'].includes(page) && (
            <>
              {page !== 'Transactions' && (
                <div className="metrics">
                  {(() => {
                    const s = state.summaries.find(
                      (x) =>
                        x.kind === (page === 'Money In' ? 'Sales Invoice' : 'Supplier Invoice'),
                    )!;
                    return (
                      <>
                        <Metric
                          label={page === 'Money In' ? 'Total invoiced' : 'Total approved bills'}
                          value={money(s.total, state.company.currency)}
                          note={`All dates · ${state.company.currency} only`}
                          icon={<FileText size={18} />}
                        />
                        <Metric
                          label={page === 'Money In' ? 'Cash collected' : 'Payments matched'}
                          value={money(s.paid, state.company.currency)}
                          note="Confirmed bank allocations"
                          icon={<Wallet size={18} />}
                        />
                        <Metric
                          label="Outstanding"
                          value={money(s.outstanding, state.company.currency)}
                          note="Still awaiting settlement"
                          icon={<Clock3 size={18} />}
                        />
                        <Metric
                          label="Overdue"
                          value={money(s.overdue, state.company.currency)}
                          note="Past due date · payment not fully matched"
                          icon={<AlertTriangle size={18} />}
                        />
                      </>
                    );
                  })()}
                </div>
              )}
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    {page === 'Transactions'
                      ? 'Approved transactions'
                      : page === 'Money In'
                        ? 'Sales invoices'
                        : 'Supplier bills & expenses'}
                  </h2>
                  {canEdit && page !== 'Transactions' && (
                    <ApproveAll
                      key={`${companyId}:${page}`}
                      rows={moneyRows}
                      action={action}
                      busy={busy}
                    />
                  )}
                  <a
                    className="button secondary"
                    href={exportLink(page === 'Transactions' ? 'transactions' : 'invoices')}
                  >
                    <Download size={16} />
                    Export CSV
                  </a>
                </div>
                <Toolbar
                  search={search}
                  setSearch={setSearch}
                  filter={filter}
                  setFilter={setFilter}
                  options={[
                    'All',
                    'Draft',
                    'Unpaid',
                    'Partially Paid',
                    'Paid',
                    'Overdue',
                    'Needs Review',
                    'Cancelled',
                  ]}
                />
                {invoiceTable(moneyRows)}
              </section>
              {page === 'Money Out' && claimBundles()}
            </>
          )}
          {page === 'Documents' && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <h2>Document centre</h2>
                  <p>{state.provider}. Originals and extraction results are retained.</p>
                </div>
                <a className="button secondary" href={exportLink('invoices')}>
                  <Download size={16} />
                  Export CSV
                </a>
              </div>
              <div className="tabs">
                {['All', 'Needs Review', 'Approved', 'Duplicate', 'Originals'].map((x) => (
                  <button
                    className={filter === x ? 'active' : ''}
                    key={x}
                    onClick={() => setFilter(x)}
                  >
                    {x}
                    {x === 'Needs Review' && <span>{needReview.length}</span>}
                  </button>
                ))}
              </div>
              <Toolbar search={search} setSearch={setSearch} />
              {filter === 'Originals' ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Uploaded</th>
                        <th>Type</th>
                        <th>Processing</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {state.documents.filter(matches).map((d) => {
                        const job = state.jobs.find((j) => j.documentId === d.id);
                        return (
                          <tr key={d.id}>
                            <td>
                              <b>{d.name}</b>
                              <small>
                                {(d.size / 1024).toFixed(1)} KB · SHA-256 {d.hash.slice(0, 12)}…
                              </small>
                            </td>
                            <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                            <td>{d.purpose}</td>
                            <td>
                              <Badge>{job?.status || 'Stored'}</Badge>
                              {job?.error && <small className="error-text">{job.error}</small>}
                            </td>
                            <td>
                              <a className="text-button" href={docLink(d.id)}>
                                Download
                                <Download size={14} />
                              </a>
                              {job?.status === 'failed' && (
                                <button
                                  className="text-button"
                                  onClick={() => run(() => action('jobs.retry', { id: job.id }))}
                                >
                                  Retry extraction
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  <DocumentCalendar
                    key={companyId}
                    invoices={state.invoices.filter(
                      (i) =>
                        !i.claimId &&
                        !i.deleted &&
                        matches(i) &&
                        (filter === 'All' ||
                          (filter === 'Duplicate' && !!i.duplicateOf) ||
                          (filter === 'Needs Review' &&
                            ['Ready', 'Needs Review'].includes(i.reviewStatus)) ||
                          i.reviewStatus === filter),
                    )}
                    renderTable={(rows) => invoiceTable(rows, true)}
                  />
                  {claimBundles()}
                </>
              )}
            </section>
          )}
          {page === 'Claims' && (
            <section className="panel">
              <div className="section-heading">
                <h2>Claim requests</h2>
                {canEdit && (
                  <button className="button secondary" onClick={() => setModal('claim-link')}>
                    Send link to employee
                  </button>
                )}
                {state.actor.role === 'Admin' && (
                  <button className="button primary" onClick={() => setModal('employee-create')}>
                    <Plus size={16} /> Add employee
                  </button>
                )}
                <a className="button secondary" href={exportLink('claims')}>
                  <Download size={16} />
                  Export CSV
                </a>
              </div>
              <Toolbar
                search={search}
                setSearch={setSearch}
                filter={filter}
                setFilter={setFilter}
                options={[
                  'All',
                  'Draft',
                  'Submitted',
                  'Needs Review',
                  'Manager Approved',
                  'Finance Approved',
                  'Paid',
                  'Rejected',
                ]}
              />
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Employee</th>
                      <th>Claimed</th>
                      <th>Receipt total</th>
                      <th>Difference</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {state.claims
                      .filter(
                        (c) =>
                          !c.deleted &&
                          c.month === month &&
                          matches(c) &&
                          (filter === 'All' || c.paymentStatus === filter),
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td>
                            <b>{c.title}</b>
                            <small>
                              {c.receiptCount} receipts · {c.month}
                            </small>
                          </td>
                          <td>{c.employeeName}</td>
                          <td className="amount">{money(c.claimedMinor, c.currency)}</td>
                          <td className="amount">{money(c.receiptTotal, c.currency)}</td>
                          <td className={c.difference ? 'error-text' : 'muted'}>
                            {money(c.difference, c.currency)}
                          </td>
                          <td>
                            <Badge>{c.paymentStatus}</Badge>
                          </td>
                          <td>
                            <button
                              className="text-button"
                              onClick={() => {
                                setSelectedClaim(c);
                                setModal('claim');
                              }}
                            >
                              Open
                              <ArrowRight size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!state.claims.some((c) => c.month === month) && (
                  <Empty title="No claims this month">
                    Create a claim, add your receipts, and submit it for review.
                  </Empty>
                )}
              </div>
            </section>
          )}
          {page === 'Bank Matching' && (
            <Reconciliation
              state={state}
              month={month}
              search={search}
              setSearch={setSearch}
              filter={filter}
              setFilter={setFilter}
              action={action}
              busy={busy}
              canEdit={canEdit}
              openStatement={(s) => {
                setSelectedStatement(s);
                setModal('statement');
              }}
              exportLink={exportLink('reconciliation')}
            />
          )}
          {page === 'Deleted records' && canEdit && (
            <section className="panel" style={{ padding: 24 }}>
              <h2>Deleted records</h2>
              {!state.invoices.some((i) => i.deleted && !i.claimId) &&
                !state.claims.some((c) => c.deleted) && (
                  <Empty title="No deleted records">
                    Records you delete will appear here for restoration.
                  </Empty>
                )}
              <p>
                These records are hidden from active lists. Original evidence and posted financial
                totals are retained.
              </p>
              {[
                ...state.invoices
                  .filter((i) => i.deleted && !i.claimId)
                  .map((i) => ({
                    id: i.id,
                    type: 'invoice',
                    name: i.number || i.party || 'Invoice',
                  })),
                ...state.claims
                  .filter((c) => c.deleted)
                  .map((c) => ({
                    id: c.id,
                    type: 'claim',
                    name: `${c.employeeName} claim — ${c.title}`,
                  })),
              ].map((record) => (
                <p key={record.id}>
                  {record.name}{' '}
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void action('record.trash', {
                        ...record,
                        deleted: false,
                        reason: 'Restored from deleted records',
                      }).catch(() => {})
                    }
                  >
                    Restore
                  </button>
                </p>
              ))}
            </section>
          )}

          {page === 'Settings' && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <h2>Google sign-in</h2>
                <p>
                  Link the Google account with your current email to sign in without a password next
                  time.
                </p>
                <GoogleButton link notify={notify} />
              </section>
              <section className="panel settings-panel">
                <h2>Workspace details</h2>
                <dl>
                  <dt>Company</dt>
                  <dd>{state.company.name}</dd>
                  <dt>Base currency</dt>
                  <dd>{state.company.currency}</dd>
                  <dt>Timezone</dt>
                  <dd>{state.company.timezone}</dd>
                  <dt>Your access</dt>
                  <dd>
                    <Badge>{state.actor.role}</Badge>
                  </dd>
                </dl>
                <button className="button secondary" onClick={() => setModal('workspace-create')}>
                  <Plus size={16} />
                  Create another workspace
                </button>
              </section>
              <section className="panel settings-panel">
                <h2>Extraction & storage</h2>
                <dl>
                  <dt>AI extraction</dt>
                  <dd>{state.provider}</dd>
                  <dt>Database</dt>
                  <dd>{state.local ? 'Local PostgreSQL (PGlite)' : 'PostgreSQL'}</dd>
                  <dt>Evidence</dt>
                  <dd>Originals + extraction + approval history</dd>
                </dl>
                <p className="muted">
                  A live AI provider is configured on the server. Unconfigured extraction leaves
                  fields missing for review.
                </p>
              </section>
              <section className="panel full-width">
                <div className="section-heading">
                  <h2>People & permissions</h2>
                  {state.actor.role === 'Admin' && (
                    <button className="button secondary" onClick={() => setModal('member')}>
                      <Plus size={16} />
                      Add / update member
                    </button>
                  )}
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Department</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.members.map((m) => (
                        <tr key={m.id}>
                          <td>{m.name}</td>
                          <td>{m.email}</td>
                          <td>
                            <Badge>{m.role}</Badge>
                          </td>
                          <td>{m.department || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel full-width">
                <div className="section-heading">
                  <h2>Audit trail</h2>
                  <span className="muted">Latest 200 events · append-only</span>
                </div>
                <div className="audit-list">
                  {state.audit.map(({ event: e, actorName }) => (
                    <details key={e.id}>
                      <summary>
                        <ShieldCheck size={16} />
                        <span>
                          <b>{e.action.replaceAll('.', ' / ')}</b>
                          <small>
                            {actorName} · {new Date(e.createdAt).toLocaleString()}
                          </small>
                        </span>
                        <span className="muted">{e.reason || 'Recorded change'}</span>
                      </summary>
                      <pre>{JSON.stringify({ before: e.before, after: e.after }, null, 2)}</pre>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          )}
          {['Budget', 'Reports', 'AI Finance'].includes(page) && (
            <section className="panel upcoming">
              <span className="upcoming-icon">
                {page === 'Budget' ? (
                  <Target size={32} />
                ) : page === 'Reports' ? (
                  <BarChart3 size={32} />
                ) : (
                  <Sparkles size={32} />
                )}
              </span>
              <span className="pill">
                {page === 'Budget' ? 'STAGE 7' : page === 'Reports' ? 'STAGE 8' : 'STAGE 9'}
              </span>
              <h2>
                {page === 'Budget'
                  ? 'Plan with the numbers you can trust.'
                  : page === 'Reports'
                    ? 'Turn your records into a management view.'
                    : 'Your company data. Clear answers.'}
              </h2>
              <p>
                {page === 'Budget'
                  ? 'Monthly budgets, budget vs actual, burn rate and runway are scheduled after the financial calculation services in Stage 6.'
                  : page === 'Reports'
                    ? 'Financial reports, month-end closing and the monthly AI management report follow the foundation and reconciliation stages.'
                    : 'Finance chat will query your actual company records and cite its sources. It is scheduled for Stage 9.'}
              </p>
              <button className="button primary" onClick={() => navigate('Documents')}>
                Continue reviewing documents
                <ArrowRight size={16} />
              </button>
            </section>
          )}
          <footer className="content-footer">
            <span>
              2ndCFO <i /> AI Finance & Budgeting System
            </span>
            <span>
              <ShieldCheck size={13} /> Human-approved. Always traceable.
            </span>
          </footer>
        </main>
      </div>
      {modal === 'upload' && (
        <Modal title={selectedClaim ? 'Upload claim receipts' : 'Upload documents'} onClose={close}>
          <UploadForm
            companyId={companyId}
            claimId={selectedClaim?.id}
            onDone={async () => {
              await refresh(companyId);
              if (selectedClaim) setModal('claim');
              else {
                close();
                navigate('Documents');
              }
            }}
            notify={notify}
          />
        </Modal>
      )}
      {modal === 'invoice' && selectedInvoice && (
        <Modal title="Review document" onClose={close} wide>
          <InvoiceReview
            invoice={selectedInvoice}
            state={state}
            canEdit={canEdit}
            busy={busy}
            action={action}
            docLink={docLink}
            onDone={close}
          />
        </Modal>
      )}
      {trashTarget && (
        <Modal title={`Delete ${trashTarget.name}`} onClose={() => setTrashTarget(null)}>
          <p>
            This removes the record from active lists. Receipts, approvals and bank payments remain
            in audit history, and posted totals stay unchanged. You can restore it from Deleted
            records.
          </p>
          <SimpleForm
            busy={busy}
            submit="Delete record"
            fields={[{ name: 'reason', label: 'Reason' }]}
            onSubmit={async ({ reason }) => {
              await action('record.trash', { ...trashTarget, deleted: true, reason });
              setTrashTarget(null);
              close();
            }}
          />
        </Modal>
      )}
      {modal === 'claim-link' && (
        <Modal title="Send claim link to employee" onClose={close}>
          <ClaimLinkForm state={state} month={month} action={action} busy={busy} />
        </Modal>
      )}
      {modal === 'employee-create' && (
        <Modal title="Add employee" onClose={close}>
          <p>
            Create an Employee login for this workspace. Share the login details with the employee
            yourself; no email is sent. Existing accounts can be added in Settings.
          </p>
          <SimpleForm
            busy={busy}
            submit="Add employee"
            fields={[
              { name: 'name', label: 'Employee name' },
              { name: 'email', label: 'Email address', type: 'email' },
              { name: 'department', label: 'Department' },
              {
                name: 'password',
                label: 'Login password (at least 8 characters)',
                type: 'password',
              },
            ]}
            onSubmit={async (data) => {
              await action(
                'employee.create',
                data,
                'Employee added. Select them when creating a claim.',
              );
              close();
            }}
          />
        </Modal>
      )}
      {modal === 'claim-create' && (
        <Modal title="New claim" onClose={close}>
          <CreateClaim
            state={state}
            month={month}
            busy={busy}
            onSave={async (input) => {
              const result = await action(
                'claim.create',
                input,
                'Claim created. Add your supporting receipts.',
              );
              const next = await refresh(companyId);
              setSelectedClaim(next!.state.claims.find((x) => x.id === result.id)!);
              setModal('upload');
            }}
          />
        </Modal>
      )}
      {modal === 'claim' && selectedClaim && (
        <Modal title="Claim details" onClose={close} wide>
          <ClaimDetail
            claim={state.claims.find((c) => c.id === selectedClaim.id) || selectedClaim}
            state={state}
            busy={busy}
            action={action}
            upload={() => setModal('upload')}
            review={selectInvoice}
          />
          {canEdit && (
            <button
              className="button secondary"
              onClick={() => {
                setModal(null);
                setTrashTarget({
                  id: selectedClaim.id,
                  type: 'claim',
                  name: `${selectedClaim.employeeName} claim`,
                });
              }}
            >
              Delete claim
            </button>
          )}
        </Modal>
      )}
      {modal === 'statement-upload' && (
        <Modal title="Import bank statement" onClose={close}>
          <BankUpload
            state={state}
            busy={busy}
            action={action}
            notify={notify}
            onDone={async (id) => {
              const next = await refresh(companyId);
              const statement = next!.state.statements.find((x) => x.id === id)!;
              setMonth(statement.month);
              navigate('Bank Matching');
              setSelectedStatement(statement);
              setModal('statement');
            }}
          />
        </Modal>
      )}
      {modal === 'statement' && selectedStatement && (
        <Modal title="Review bank statement" onClose={close} wide>
          <StatementReview
            statement={
              state.statements.find((s) => s.id === selectedStatement.id) || selectedStatement
            }
            action={action}
            busy={busy}
            docLink={docLink}
            onDone={close}
          />
        </Modal>
      )}
      {modal === 'member' && (
        <Modal title="Workspace member" onClose={close}>
          <SimpleForm
            fields={[
              { name: 'email', label: 'Registered email', type: 'email' },
              {
                name: 'role',
                label: 'Role',
                options: ['Employee', 'Manager', 'Finance', 'Accountant', 'Admin'],
              },
              { name: 'department', label: 'Department (required for Managers)', optional: true },
            ]}
            busy={busy}
            submit="Save member"
            onSubmit={async (d) => {
              await action('member.assign', { ...d, department: d.department || null });
              close();
            }}
          />
          <p className="muted">
            The person must already have an account. This adds access without sending an invitation.
          </p>
        </Modal>
      )}
      {modal === 'workspace-create' && (
        <Modal title="Create company workspace" onClose={close}>
          <SimpleForm
            fields={[{ name: 'name', label: 'Company name' }]}
            busy={busy}
            submit="Create workspace"
            onSubmit={async (d) => {
              const w = await action('workspace.create', d);
              await refresh(w.id);
              close();
            }}
          />
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="Your finance workflow" onClose={close}>
          <div className="help-copy">
            <p>
              <b>1. Upload.</b> Add up to 200 invoices or receipts per batch. Each original stays
              attached to its record.
            </p>
            <p>
              <b>2. Review.</b> Check extracted fields, missing values and duplicate warnings.
              Approve only verified records.
            </p>
            <p>
              <b>3. Match payments.</b> Import a bank statement, review its rows, then confirm
              suggested or manual matches.
            </p>
            <p>
              <b>Claims.</b> Create a claim and upload receipts. Manager and Finance approval are
              separate steps; only bank settlement marks it paid.
            </p>
            <p>
              Budgets, full financial reporting and chat remain in the next implementation stages.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Toolbar({
  search,
  setSearch,
  filter,
  setFilter,
  options,
}: {
  search: string;
  setSearch: (v: string) => void;
  filter?: string;
  setFilter?: (v: string) => void;
  options?: string[];
}) {
  return (
    <div className="toolbar">
      <label className="search-field">
        <Search size={17} />
        <input
          aria-label="Search records"
          placeholder="Search name, invoice, amount…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {options && (
        <select
          aria-label="Filter status"
          value={filter}
          onChange={(e) => setFilter?.(e.target.value)}
        >
          {options.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      )}
    </div>
  );
}
function Login({
  onComplete,
  notify,
  message,
}: {
  onComplete: () => Promise<unknown>;
  notify: (s: string, e?: boolean) => void;
  message: { text: string; error: boolean } | null;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  const submit = async (data: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await onComplete();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Unable to sign in.', true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            2ndCFO<small>POWERED BY CREATIQ AI</small>
          </span>
        </div>
        <div className="login-pitch">
          <span className="eyebrow">A SECOND PAIR OF EYES ON YOUR FINANCES</span>
          <h1>
            Less paperwork.
            <br />
            More perspective.
          </h1>
          <p>
            Bring your invoices, receipts, and bank statements together. Keep the decisions in your
            hands.
          </p>
          <div className="login-flow">
            <span>
              <UploadCloud />
              Upload
            </span>
            <ArrowRight />
            <span>
              <FileCheck2 />
              Review
            </span>
            <ArrowRight />
            <span>
              <ArrowLeftRight />
              Match payments
            </span>
          </div>
        </div>
        <p className="login-foot">
          <ShieldCheck size={18} />
          AI suggests. People approve. Every change is recorded.
        </p>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">YOUR FINANCE WORKSPACE</span>
          <h2>{signup ? 'Start with a clear picture.' : 'Welcome back.'}</h2>
          <p>
            {signup
              ? 'Create your account and a private company workspace.'
              : 'Sign in to pick up where you left off.'}
          </p>
          {message?.error && (
            <div role="alert" className="form-error">
              {message.text}
            </div>
          )}
          <GoogleButton notify={notify} />
          <div className="divider">OR CONTINUE WITH EMAIL</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({ action: signup ? 'signup' : 'login', ...Object.fromEntries(form) });
            }}
          >
            {signup && (
              <>
                <FormField label="Your name">
                  <input name="name" autoComplete="name" required minLength={2} />
                </FormField>
                <FormField label="Company name">
                  <input name="company" autoComplete="organization" required minLength={2} />
                </FormField>
              </>
            )}
            <FormField label="Email address">
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </FormField>
            <FormField label="Password">
              <input
                type="password"
                name="password"
                minLength={8}
                maxLength={128}
                autoComplete={signup ? 'new-password' : 'current-password'}
                placeholder="At least 8 characters — no capitals or numbers required"
                required
              />
            </FormField>
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : signup ? (
                'Create workspace'
              ) : (
                'Sign in'
              )}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="switch-auth">
            {signup ? 'Already have an account?' : 'New to 2ndCFO?'}{' '}
            <button onClick={() => setSignup(!signup)}>
              {signup ? 'Sign in' : 'Create a workspace'}
            </button>
          </p>
          <div className="divider">OR TAKE A LOOK AROUND</div>
          <button
            className="button secondary full"
            disabled={busy}
            onClick={() => void submit({ action: 'demo' })}
          >
            <Sparkles size={17} />
            Explore a demo workspace
          </button>
          <small className="demo-note">
            Local preview only. Sample records are isolated from real company data.
          </small>
        </div>
      </section>
    </main>
  );
}
type Action = (a: string, input?: Record<string, unknown>, success?: string) => Promise<unknown>;

function ClaimLinkForm({
  state,
  month,
  action,
  busy,
}: {
  state: State;
  month: string;
  action: Action;
  busy: boolean;
}) {
  const [link, setLink] = useState(''),
    [email, setEmail] = useState(''),
    [copied, setCopied] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      {!link ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            setError('');
            void action('claim.link', { ...data, currency: state.company.currency })
              .then((result) => {
                const r = result as { token: string };
                setLink(`${window.location.origin}/claim#token=${r.token}`);
                setEmail(state.members.find((m) => m.id === data.employeeId)?.email || '');
              })
              .catch((e) => setError(e.message));
          }}
        >
          <FormField label="Employee">
            <select name="employeeId" required>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.email}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Claim month">
            <input name="month" type="month" defaultValue={month} required />
          </FormField>
          <FormField label="Claim description">
            <input name="title" defaultValue="Employee expenses" required minLength={2} />
          </FormField>
          <p>
            Creates one receipt bundle for this employee. The unused link expires after 7 days and
            can be opened once. After opening, the employee has 24 hours to finish.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy || !state.members.length}>
            Create one-time link
          </button>
        </form>
      ) : (
        <>
          <p>
            Send this private link only to the selected employee. They can upload receipts and
            submit this claim without signing in.
          </p>
          <input
            aria-label="Employee claim link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          {/\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(link) && (
            <p className="notice">
              This localhost link only works on this computer. Create employee links from your
              deployed app when sharing to other devices.
            </p>
          )}
          <button
            className="button primary"
            onClick={() => {
              void navigator.clipboard
                .writeText(link)
                .then(() => setCopied(true))
                .catch(() => setError('Select the link above and copy it manually.'));
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <a
            className="button secondary"
            href={`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your employee claim link')}&body=${encodeURIComponent(`Please fill in your claim and upload receipts using this one-time link (expires in 7 days):\n\n${link}`)}`}
          >
            Open email draft
          </a>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </>
  );
}

function ApproveAll({ rows, action, busy }: { rows: Invoice[]; action: Action; busy: boolean }) {
  const candidates = rows.filter((i) =>
    ['Ready', 'Needs Review', 'Draft'].includes(i.reviewStatus),
  );
  const [batch, setBatch] = useState<Invoice[] | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ id: string; message: string }[]>([]);
  const [finished, setFinished] = useState(false);
  const run = async () => {
    if (!batch || running) return;
    setRunning(true);
    try {
      for (const invoice of batch) {
        let message = 'Approved';
        try {
          // Reuse normal approval: role, version, closed period, amount and duplicate checks.
          await action(
            'invoice.review',
            {
              id: invoice.id,
              version: invoice.version,
              operation: 'approve',
              reason: '',
            },
            'Invoice approved. Cash has not changed.',
          );
        } catch (error) {
          message =
            error instanceof Error ? error.message : 'Approval failed. Review individually.';
        }
        setResults((previous) => [...previous, { id: invoice.id, message }]);
      }
      setFinished(true);
    } finally {
      setRunning(false);
    }
  };
  return (
    <>
      <button
        className="button primary"
        disabled={busy || !candidates.length}
        onClick={() => {
          setBatch([...candidates]);
          setResults([]);
          setFinished(false);
        }}
      >
        <CheckCheck size={16} /> Approve all ({candidates.length})
      </button>
      {batch && (
        <Modal
          title="Approve all listed invoices"
          wide
          onClose={() => {
            if (!running) setBatch(null);
          }}
        >
          <p>
            Review these {batch.length} invoices from the current filtered list before confirming.
            Approval locks the invoice details; it does not record payment. Incomplete invoices,
            duplicates and closed periods still need individual review.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Party</th>
                  <th>Amount</th>
                  <th>Review / result</th>
                </tr>
              </thead>
              <tbody>
                {batch.map((i) => (
                  <tr key={i.id}>
                    <td>{i.number || i.documentName}</td>
                    <td>{i.party || 'Missing party'}</td>
                    <td>{i.currency ? money(i.totalMinor, i.currency) : 'Currency missing'}</td>
                    <td>
                      {results.find((r) => r.id === i.id)?.message ||
                        (i.reviewStatus === 'Ready' ? 'Ready' : invoiceReviewReason(i))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p role="status">
            {running
              ? `Processed ${results.length} of ${batch.length}…`
              : finished
                ? `${results.filter((r) => r.message === 'Approved').length} approved; ${results.filter((r) => r.message !== 'Approved').length} need individual review.`
                : 'Rejected and already approved invoices are excluded.'}
          </p>
          <button
            className="button primary"
            disabled={running || busy}
            onClick={() => {
              if (finished) setBatch(null);
              else void run();
            }}
          >
            {running
              ? 'Approving…'
              : finished
                ? 'Done'
                : `Confirm approval of ${batch.length} invoices`}
          </button>
        </Modal>
      )}
    </>
  );
}
function SimpleForm({
  fields,
  busy,
  onSubmit,
  submit,
}: {
  fields: {
    name: string;
    label: string;
    type?: string;
    options?: string[];
    optional?: boolean;
    value?: string;
  }[];
  busy: boolean;
  onSubmit: (d: Record<string, string>) => Promise<unknown>;
  submit: string;
}) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        void onSubmit(values).catch((e) => setError(e.message));
      }}
    >
      {fields.map((f) => (
        <FormField label={f.label} key={f.name}>
          {f.options ? (
            <select name={f.name} defaultValue={f.value}>
              {f.options.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              name={f.name}
              type={f.type || 'text'}
              defaultValue={f.value}
              required={!f.optional}
            />
          )}
        </FormField>
      ))}
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      <button className="button primary full" disabled={busy}>
        {busy ? <LoaderCircle className="spin" size={16} /> : submit}
      </button>
    </form>
  );
}
function UploadForm({
  companyId,
  claimId,
  onDone,
  notify,
}: {
  companyId: string;
  claimId?: string;
  onDone: () => Promise<unknown>;
  notify: (s: string, e?: boolean) => void;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [paymentDays, setPaymentDays] = useState(''),
    [results, setResults] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false),
    [batchId] = useState(() => crypto.randomUUID());
  const input = useRef<HTMLInputElement>(null);
  const add = (incoming: FileList | null) => {
    if (!incoming) return;
    const list = [...files, ...Array.from(incoming)];
    if (list.length > 200) {
      notify('Choose no more than 200 files per batch.', true);
      return;
    }
    setFiles(list);
  };
  const upload = async () => {
    setBusy(true);
    for (const [index, file] of files.entries()) {
      if (results[index] === 'Uploaded') continue;
      const form = new FormData();
      form.set('file', file);
      form.set('batchId', batchId);
      if (!claimId && paymentDays !== '') form.set('defaultPaymentTermDays', paymentDays);
      if (claimId) form.set('claimId', claimId);
      setResults((r) => ({ ...r, [index]: 'Uploading…' }));
      try {
        const r = await fetch('/api/upload?company=' + companyId, { method: 'POST', body: form });
        const data = await r.json();
        setResults((v) => ({ ...v, [index]: r.ok ? 'Uploaded' : data.error }));
      } catch {
        setResults((r) => ({ ...r, [index]: 'Upload failed. Retry this batch.' }));
      }
    }
    setBusy(false);
  };
  return (
    <>
      <div
        className={'dropzone ' + (drag ? 'dragging' : '')}
        role="button"
        tabIndex={0}
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') input.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) add(e.dataTransfer.files);
        }}
      >
        <span>
          <UploadCloud size={30} />
        </span>
        <h3>Drop your {claimId ? 'receipts' : 'documents'} here</h3>
        <p>
          or <b>browse files</b> on your computer
        </p>
        <small>PDF, JPG, JPEG, PNG · 20 MB each · Up to 200 files</small>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          hidden
          onChange={(e) => add(e.target.files)}
        />
      </div>
      <div className="notice">
        <ShieldCheck size={17} />
        <span>
          Original files are retained. Extraction suggestions need your review before becoming final
          records.
        </span>
      </div>
      {!claimId && (
        <>
          <FormField label="Default payment terms for this upload">
            <select
              value={paymentDays}
              onChange={(e) => setPaymentDays(e.target.value)}
              disabled={busy || Object.keys(results).length > 0}
            >
              <option value="">Use document terms only</option>
              {[0, 7, 14, 30, 45, 60, 90].map((days) => (
                <option key={days} value={days}>
                  {days === 0 ? 'Due on invoice date' : `${days} days from invoice date`}
                </option>
              ))}
            </select>
          </FormField>
          <p className="muted">
            Applies to every invoice in these files when its own payment terms and due date are
            missing. Due dates count from each invoice’s date, not the upload date. Review or edit
            the terms before approval.
          </p>
        </>
      )}
      {files.length > 0 && (
        <>
          <div className="section-heading compact">
            <b>{files.length} files selected</b>
            <span>{Object.values(results).filter((x) => x === 'Uploaded').length} uploaded</span>
          </div>
          <ul className="upload-list">
            {files.map((f, i) => (
              <li key={i}>
                <FileText size={17} />
                <span>
                  {f.name}
                  <small>{results[i] || `${(f.size / 1024).toFixed(0)} KB`}</small>
                </span>
                {results[i] === 'Uploaded' ? (
                  <Check className="green-text" size={18} />
                ) : (
                  !busy &&
                  !results[i] &&
                  Object.keys(results).length === 0 && (
                    <button
                      className="icon-button"
                      aria-label={'Remove ' + f.name}
                      onClick={() => {
                        setFiles(files.filter((_, idx) => idx !== i));
                        setResults({});
                      }}
                    >
                      <X size={16} />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={() => void onDone()}>
          Done
        </button>
        <button
          className="button primary"
          disabled={
            busy ||
            !files.length ||
            Object.values(results).filter((x) => x === 'Uploaded').length === files.length
          }
          onClick={() => void upload()}
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}Upload{' '}
          {files.length || ''} files
        </button>
      </div>
    </>
  );
}
function DocumentPreview({ src, name }: { src: string; name: string }) {
  const [preview, setPreview] = useState<{ url: string; mime: string; data?: Uint8Array } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setPreview(null);
    setError('');
    void (async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load this document. Please retry.');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type))
          throw new Error(
            'Preview is unavailable for this file type. Download the original to view it.',
          );
        if (blob.type === 'application/pdf') {
          const data = new Uint8Array(await blob.arrayBuffer());
          if (!controller.signal.aborted) setPreview({ url: '', mime: blob.type, data });
        } else {
          objectUrl = URL.createObjectURL(blob);
          setPreview({ url: objectUrl, mime: blob.type });
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load document.');
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, attempt]);
  return (
    <section className="document-preview" aria-label="Original document preview">
      <div className="document-preview-heading">
        <b>Document preview</b>
        <a href={src} className="text-button">
          Download original
        </a>
      </div>
      {error ? (
        <div className="document-preview-message" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Retry preview
          </button>
        </div>
      ) : !preview ? (
        <p className="document-preview-message" role="status">
          Loading document…
        </p>
      ) : preview.mime === 'application/pdf' ? (
        <>
          <PdfPreview data={preview.data!} name={name} />
          <p className="document-preview-hint">
            If the PDF does not display on your device, use Download original above.
          </p>
        </>
      ) : (
        <img
          src={preview.url}
          alt={`Original document: ${name}`}
          onError={() => setError('Unable to display this image. Download the original or retry.')}
        />
      )}
    </section>
  );
}

function InvoiceReview({
  invoice: i,
  state,
  canEdit,
  busy,
  action,
  docLink,
  onDone,
}: {
  invoice: Invoice;
  state: State;
  canEdit: boolean;
  busy: boolean;
  action: Action;
  docLink: (id: string, s?: number, e?: number) => string;
  onDone: () => void;
}) {
  const [error, setError] = useState(''),
    [reason, setReason] = useState(''),
    [operation, setOperation] = useState('save');
  const approved = i.reviewStatus === 'Approved';
  const canCorrect =
    !approved &&
    (canEdit ||
      (i.claimId &&
        state.claims.some(
          (c) =>
            c.id === i.claimId &&
            c.employeeId === state.actor.userId &&
            ['Draft', 'Needs Review'].includes(c.status),
        )));
  const fields = [
    ['party', 'Supplier / customer', i.party],
    ['number', 'Invoice / receipt number', i.number],
    ['invoiceDate', 'Invoice date', i.invoiceDate, 'date'],
    ['dueDate', 'Due date', i.dueDate, 'date'],
    ['subtotal', 'Subtotal', dec(i.subtotalMinor)],
    ['tax', 'Tax', dec(i.taxMinor)],
    ['total', 'Total amount', dec(i.totalMinor)],
    ['description', 'Description', i.description],
    ['product', 'Product / service', i.product],
    ['paymentTerms', 'Payment terms', i.paymentTerms],
    ['bankReference', 'Bank reference', i.bankReference],
  ];
  return (
    <>
      <div className="review-top">
        <div>
          <b>{i.documentName}</b>
          <small>
            Source pages {i.pageStart}–{i.pageEnd} · Confidence {i.confidence}%
          </small>
        </div>
        <a className="button secondary" href={docLink(i.documentId)}>
          <Download size={16} />
          Original
        </a>
        {i.pageEnd > 1 && (
          <a className="button secondary" href={docLink(i.documentId, i.pageStart, i.pageEnd)}>
            These pages
          </a>
        )}
      </div>
      {i.duplicateOf && (
        <div className="notice warning">
          <AlertTriangle size={18} />
          <span>
            <b>Possible duplicate.</b> {i.duplicateReason}. Verify the previous record; an approval
            explanation is required.
          </span>
        </div>
      )}
      {i.confidence < 80 && !approved && (
        <div className="notice warning">
          Low confidence or missing data. Verify every field against the original.
        </div>
      )}
      <DocumentPreview
        key={`${i.id}-${i.version}`}
        src={
          state.documents.find((d) => d.id === i.documentId)?.mime === 'application/pdf'
            ? docLink(i.documentId, i.pageStart, i.pageEnd)
            : docLink(i.documentId)
        }
        name={i.documentName}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          const values = Object.fromEntries(new FormData(e.currentTarget));
          const fields = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v || null]));
          void action(
            'invoice.review',
            { id: i.id, version: i.version, operation, fields, reason },
            operation === 'approve' ? 'Invoice approved. Cash has not changed.' : 'Review saved.',
          )
            .then(onDone)
            .catch((e) => setError(e.message));
        }}
      >
        <fieldset disabled={!canCorrect || busy}>
          <div className="form-grid">
            <FormField label="Document type">
              <select name="kind" defaultValue={i.kind}>
                {[
                  'Sales Invoice',
                  'Supplier Invoice',
                  'Receipt',
                  'Claim Receipt',
                  'Other Financial Document',
                ].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Category">
              <select name="category" defaultValue={i.category || ''}>
                <option value="">Unknown / select category</option>
                {state.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Currency">
              <select name="currency" defaultValue={i.currency || ''}>
                <option value="">Unknown</option>
                {state.currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            {fields.map(([name, label, value, type]) => (
              <FormField key={name} label={label!}>
                <input name={name!} defaultValue={value || ''} type={type || 'text'} />
              </FormField>
            ))}
          </div>
        </fieldset>
        {canCorrect && (
          <FormField label="Review / exception reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain corrections, rejection, or why a flagged duplicate is valid."
            />
          </FormField>
        )}
        {error && (
          <div role="alert" className="form-error">
            {error}
          </div>
        )}
        {canCorrect && (
          <div className="modal-actions">
            {canEdit && (
              <>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => setOperation('reject')}
                >
                  Reject
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setOperation('review')}
                >
                  Needs review
                </button>
              </>
            )}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setOperation('save')}
            >
              Save changes
            </button>
            {canEdit && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => setOperation('approve')}
              >
                <Check size={16} />
                Approve record
              </button>
            )}
          </div>
        )}
      </form>
      <InvoiceCancellation
        invoice={i}
        canEdit={canEdit}
        action={action}
        busy={busy}
        onDone={onDone}
      />
      {canEdit && !approved && i.pageEnd > i.pageStart && (
        <details className="detail-block">
          <summary>Split this PDF into separate documents</summary>
          <SimpleForm
            fields={[
              {
                name: 'splitAt',
                label: `Start the next document at page (${i.pageStart + 1}–${i.pageEnd})`,
                type: 'number',
              },
            ]}
            busy={busy}
            submit="Split page range"
            onSubmit={async (v) => {
              await action('invoice.split', { id: i.id, splitAt: Number(v.splitAt) });
              onDone();
            }}
          />
        </details>
      )}
      <details className="detail-block">
        <summary>Original AI extraction & provenance</summary>
        {state.extractions
          .filter((e) => e.documentId === i.documentId)
          .map((e) => (
            <div key={e.id}>
              <p>
                {e.provider} · {e.model || 'No model'} · {new Date(e.createdAt).toLocaleString()}
              </p>
              <pre>{JSON.stringify(e.raw, null, 2)}</pre>
            </div>
          ))}
      </details>
      {approved && (
        <div className="notice">
          <ShieldCheck size={18} />
          <span>
            Approved records are locked. Payments are tracked through bank reconciliation.
          </span>
        </div>
      )}
    </>
  );
}
function CreateClaim({
  state,
  month,
  busy,
  onSave,
}: {
  state: State;
  month: string;
  busy: boolean;
  onSave: (d: Record<string, unknown>) => Promise<unknown>;
}) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        const data = Object.fromEntries(new FormData(e.currentTarget));
        void onSave({
          ...data,
          claimed: data.claimed || '0',
          autoTotal: !String(data.claimed || '').trim(),
        }).catch((e) => setError(e.message));
      }}
    >
      <FormField label="Claim title">
        <input name="title" placeholder="September travel expenses" required />
      </FormField>
      <div className="form-grid">
        <FormField label="Claim period">
          <input type="month" name="month" defaultValue={month} required />
        </FormField>
        <FormField label="Claimed amount (optional)">
          <input name="claimed" inputMode="decimal" placeholder="Automatically total receipts" />
        </FormField>
        <FormField label="Currency">
          <select name="currency" defaultValue={state.company.currency}>
            {state.currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Employee">
          <select name="employeeId" defaultValue={state.actor.userId}>
            {state.members
              .filter(
                (m) =>
                  ['Admin', 'Finance'].includes(state.actor.role) || m.id === state.actor.userId,
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </FormField>
      </div>
      <div className="notice">
        Leave the amount blank to automatically total all uploaded receipts in this claim. Enter an
        amount only if you want to compare a specific claim amount against receipts.
      </div>
      {error && <div className="form-error">{error}</div>}
      <button className="button primary full" disabled={busy}>
        Create claim
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function ClaimDetail({
  claim: c,
  state,
  busy,
  action,
  upload,
  review,
}: {
  claim: Claim;
  state: State;
  busy: boolean;
  action: Action;
  upload: () => void;
  review: (i: Invoice) => void;
}) {
  const [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const canEdit = ['Admin', 'Finance'].includes(state.actor.role),
    owns = c.employeeId === state.actor.userId;
  const change = (operation: string, other: Record<string, unknown> = {}) => {
    setError('');
    void action('claim.change', { id: c.id, operation, reason, ...other }, 'Claim updated.').catch(
      (e) => setError(e.message),
    );
  };
  return (
    <>
      <div className="review-top">
        <div>
          <h3>{c.title}</h3>
          <p>
            {c.employeeName} · {c.month} · {c.department || 'No department'}
          </p>
        </div>
        <Badge>{c.paymentStatus}</Badge>
      </div>
      <div className="claim-totals">
        <div>
          <small>{c.autoTotal ? 'Calculated claim total' : 'Claimed amount'}</small>
          <b>{money(c.claimedMinor, c.currency)}</b>
        </div>
        <div>
          <small>Supporting receipts</small>
          <b>{money(c.receiptTotal, c.currency)}</b>
        </div>
        <div className={c.difference ? 'error-text' : ''}>
          <small>Difference</small>
          <b>{money(c.difference, c.currency)}</b>
        </div>
      </div>
      {c.needsReview && (
        <div className="notice warning">
          <AlertTriangle size={18} />
          <span>
            {c.difference !== 0
              ? 'Claim total does not match supporting receipts. Possible missing receipt. '
              : ''}
            {c.unknown > 0 ? `${c.unknown} receipt(s) have missing or inconsistent fields. ` : ''}
            {c.duplicates > 0 ? `${c.duplicates} possible duplicate(s) need review.` : ''}
          </span>
        </div>
      )}
      <div className="category-chips">
        {Object.entries(c.categories).map(([k, v]) => (
          <span key={k}>
            {k}
            <b>{money(v, c.currency)}</b>
          </span>
        ))}
      </div>
      <div className="section-heading compact">
        <h3>Supporting receipts</h3>
        {(owns || canEdit) && ['Draft', 'Needs Review'].includes(c.status) && (
          <button className="button secondary" onClick={upload}>
            <Plus size={15} />
            Add receipts
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Merchant / receipt</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Review</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.invoices
              .filter((i) => i.claimId === c.id)
              .map((i) => (
                <tr key={i.id}>
                  <td>
                    <b>{i.party || 'Unknown merchant'}</b>
                    <small>{i.number || i.documentName}</small>
                  </td>
                  <td>{money(i.totalMinor, i.currency || c.currency)}</td>
                  <td>{i.category || 'Unknown'}</td>
                  <td>
                    <Badge>{i.duplicateOf ? 'Duplicate' : i.reviewStatus}</Badge>
                  </td>
                  <td>
                    <button className="text-button" onClick={() => review(i)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!['Finance Approved', 'Rejected'].includes(c.status) && (
        <>
          <FormField label="Approval, exception or request reason">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain differences, request a receipt, or document an approval exception."
            />
          </FormField>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions wrap">
            {(owns || canEdit) && ['Draft', 'Needs Review'].includes(c.status) && (
              <button className="button primary" disabled={busy} onClick={() => change('submit')}>
                Submit claim
              </button>
            )}
            {['Admin', 'Manager'].includes(state.actor.role) &&
              ['Submitted', 'Needs Review'].includes(c.status) && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => change('manager')}
                >
                  Manager approve
                </button>
              )}
            {canEdit && c.status === 'Manager Approved' && (
              <button className="button primary" disabled={busy} onClick={() => change('finance')}>
                Finance approve
              </button>
            )}
            {['Admin', 'Finance', 'Manager'].includes(state.actor.role) && (
              <>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => change('request')}
                >
                  Request receipt
                </button>
                <button className="button danger" disabled={busy} onClick={() => change('reject')}>
                  Reject claim
                </button>
              </>
            )}
          </div>
          {(owns || canEdit) && ['Draft', 'Needs Review'].includes(c.status) && (
            <details className="detail-block">
              <summary>Adjust claimed amount</summary>
              <SimpleForm
                fields={[{ name: 'claimed', label: 'Revised amount', value: dec(c.claimedMinor) }]}
                busy={busy}
                submit="Record adjustment"
                onSubmit={(d) =>
                  action('claim.change', {
                    id: c.id,
                    operation: 'adjust',
                    claimed: d.claimed,
                    reason,
                  })
                }
              />
            </details>
          )}
        </>
      )}
      {c.exceptionReason && (
        <div className="notice">
          <span>
            <b>Recorded reason:</b> {c.exceptionReason}
          </span>
        </div>
      )}
      {c.status === 'Finance Approved' && (
        <div className="notice">
          <ShieldCheck size={18} />
          Approved for {money(c.claimedMinor, c.currency)}. {money(c.paidMinor, c.currency)} matched
          to bank payouts.
        </div>
      )}
    </>
  );
}
function BankUpload({
  state,
  busy,
  action,
  notify,
  onDone,
}: {
  state: State;
  busy: boolean;
  action: Action;
  notify: (s: string, e?: boolean) => void;
  onDone: (id: string) => Promise<unknown>;
}) {
  const [uploading, setUploading] = useState(false),
    [statementMonth, setStatementMonth] = useState(''),
    [error, setError] = useState(''),
    [newAccount, setNewAccount] = useState(!state.accounts.length);
  return (
    <>
      {newAccount ? (
        <>
          <h3>Add a bank account</h3>
          <SimpleForm
            fields={[
              { name: 'name', label: 'Account label', value: 'Operating account' },
              {
                name: 'currency',
                label: 'Account currency',
                options: [...state.currencies],
                value: state.company.currency,
              },
            ]}
            busy={busy}
            submit="Add account"
            onSubmit={async (d) => {
              await action('account.create', d);
              setNewAccount(false);
            }}
          />
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            form.set('purpose', 'statement');
            setUploading(true);
            setError('');
            void fetch('/api/upload?company=' + state.company.id, { method: 'POST', body: form })
              .then(async (r) => {
                const data = await r.json();
                if (!r.ok) throw new Error(data.error);
                await onDone(data.id);
              })
              .catch((e) => setError(e.message))
              .finally(() => setUploading(false));
          }}
        >
          <FormField label="Bank account">
            <select name="accountId">
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="text-button" onClick={() => setNewAccount(true)}>
            + Add another account
          </button>
          <FormField label="Which month and year is this bank statement for?">
            <input
              name="month"
              type="month"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
              required
              aria-describedby="statement-month-help"
            />
          </FormField>
          <p id="statement-month-help" className="muted" aria-live="polite">
            {statementMonth
              ? `After import, we’ll suggest matches with approved invoices and claims from ${monthLabel(statementMonth)}.`
              : 'Choose the month printed on your statement, even if you are uploading it later.'}{' '}
            Transactions outside this month must be corrected before import.
          </p>
          <FormField label="Bank statement">
            <input type="file" name="file" accept=".pdf,.csv,.xlsx" required />
          </FormField>
          <p className="muted">
            PDF, CSV or XLSX · Up to 20 MB. Structured imports use date, description, reference,
            money_in, money_out, balance.
          </p>
          <a className="text-button" href="/bank-statement-template.csv" download>
            <Download size={15} />
            Download CSV template
          </a>
          <div className="notice">
            Review the extracted bank rows before importing. Ambiguous dates, signs and balance
            differences block import.
          </div>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <button className="button primary full" disabled={uploading}>
            {uploading ? (
              <>
                <LoaderCircle className="spin" size={17} />
                Parsing statement…
              </>
            ) : (
              'Upload & review statement'
            )}
          </button>
        </form>
      )}
    </>
  );
}
function StatementReview({
  statement: s,
  action,
  busy,
  docLink,
  onDone,
}: {
  statement: Statement;
  action: Action;
  busy: boolean;
  docLink: (id: string) => string;
  onDone: () => void;
}) {
  type Draft = {
    opening: string | null;
    closing: string | null;
    rows: {
      date: string;
      description: string;
      reference: string;
      moneyIn: string;
      moneyOut: string;
      balance: string | null;
    }[];
    notes: string;
  };
  const [draft, setDraft] = useState(s.draft as Draft),
    [reason, setReason] = useState('Reviewed against original bank statement'),
    [allowDuplicates, setAllowDuplicates] = useState(false),
    [error, setError] = useState('');
  const edit = (index: number, key: string, value: string) =>
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    }));
  const save = (operation: string) => {
    setError('');
    void action(
      'statement.confirm',
      { id: s.id, draft, reason, allowDuplicates, operation },
      operation === 'import'
        ? 'Statement imported. Review suggested matches next.'
        : 'Statement corrections saved.',
    )
      .then(() => {
        if (operation === 'import') onDone();
      })
      .catch((e) => setError(e.message));
  };
  return (
    <>
      <div className="review-top">
        <div>
          <Badge>{s.status}</Badge>
          <p>
            {s.month} · {draft.rows.length} bank transactions
          </p>
        </div>
        <a className="button secondary" href={docLink(s.documentId)}>
          <Download size={16} />
          Original statement
        </a>
      </div>
      {draft.notes && <div className="notice">{draft.notes}</div>}
      <div className="form-grid">
        <FormField label="Opening balance (if evidenced)">
          <input
            value={draft.opening || ''}
            onChange={(e) => setDraft({ ...draft, opening: e.target.value || null })}
            disabled={s.status === 'Imported'}
          />
        </FormField>
        <FormField label="Closing balance (if evidenced)">
          <input
            value={draft.closing || ''}
            onChange={(e) => setDraft({ ...draft, closing: e.target.value || null })}
            disabled={s.status === 'Imported'}
          />
        </FormField>
      </div>
      <div className="table-scroll statement-rows">
        <table>
          <thead>
            <tr>
              {['Date', 'Description', 'Reference', 'Money in', 'Money out', 'Balance', ''].map(
                (h, i) => (
                  <th key={i}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((r, index) => (
              <tr key={index}>
                {(
                  ['date', 'description', 'reference', 'moneyIn', 'moneyOut', 'balance'] as const
                ).map((k) => (
                  <td key={k}>
                    <input
                      aria-label={`Row ${index + 1} ${k}`}
                      value={r[k] || ''}
                      type={k === 'date' ? 'date' : 'text'}
                      onChange={(e) => edit(index, k, e.target.value)}
                      disabled={s.status === 'Imported'}
                    />
                  </td>
                ))}
                <td>
                  {s.status !== 'Imported' && (
                    <button
                      className="icon-button"
                      aria-label={`Remove row ${index + 1}`}
                      onClick={() =>
                        setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== index) })
                      }
                    >
                      <X size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.status !== 'Imported' && (
        <>
          <button
            className="text-button"
            onClick={() =>
              setDraft({
                ...draft,
                rows: [
                  ...draft.rows,
                  {
                    date: `${s.month}-01`,
                    description: '',
                    reference: '',
                    moneyIn: '0',
                    moneyOut: '0',
                    balance: null,
                  },
                ],
              })
            }
          >
            <Plus size={15} />
            Add verified transaction
          </button>
          {s.validation.errors.length > 0 && (
            <details className="detail-block">
              <summary>Validation from last save ({s.validation.errors.length})</summary>
              <ul>
                {s.validation.errors.slice(0, 30).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          <FormField label="Review reason">
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allowDuplicates}
              onChange={(e) => setAllowDuplicates(e.target.checked)}
            />
            I verified any repeated bank rows are separate real transactions.
          </label>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={() => save('save')}>
              Save corrections
            </button>
            <button className="button primary" disabled={busy} onClick={() => save('import')}>
              <Check size={16} />
              Confirm import
            </button>
          </div>
        </>
      )}
    </>
  );
}
function Reconciliation({
  state,
  month,
  search,
  setSearch,
  filter,
  setFilter,
  action,
  busy,
  canEdit,
  openStatement,
  exportLink,
}: {
  state: State;
  month: string;
  search: string;
  setSearch: (s: string) => void;
  filter: string;
  setFilter: (s: string) => void;
  action: Action;
  busy: boolean;
  canEdit: boolean;
  openStatement: (s: Statement) => void;
  exportLink: string;
}) {
  const [manual, setManual] = useState(false),
    [error, setError] = useState(''),
    [reason, setReason] = useState('Verified against invoice and bank statement'),
    [lines, setLines] = useState([{ bankId: '', target: '', amount: '' }]),
    [categoryBank, setCategoryBank] = useState('');
  const banks = state.bank.filter((b) => b.date.startsWith(month)),
    done = banks.filter((b) => ['Matched', 'Categorised'].includes(b.status)).length,
    progress = banks.length ? Math.round((done / banks.length) * 100) : 0;
  const suggestions = state.suggestions.filter((s) => banks.some((b) => b.id === s.bankId));
  const run = (promise: Promise<unknown>) => {
    setError('');
    void promise.catch((e) => setError(e.message));
  };
  const filtered = banks.filter(
    (b) =>
      (filter === 'All' ||
        (filter === 'Matched' && b.status === 'Matched') ||
        (filter === 'Unmatched' && b.status === 'Unmatched') ||
        (filter === 'Partial' && b.status === 'Partial') ||
        (filter === 'Missing Document' &&
          b.status === 'Unmatched' &&
          !suggestions.some((s) => s.bankId === b.id)) ||
        (filter === 'Needs Review' &&
          suggestions.some((s) => s.bankId === b.id && s.confidence < 80))) &&
      (!search || JSON.stringify(b).toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <>
      <GroupSuggestions state={state} month={month} action={action} canEdit={canEdit} busy={busy} />
      <ReconciliationExceptions state={state} month={month} filter={filter} />
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      <section className="reconciliation-progress panel">
        <div>
          <span className="eyebrow">MONTHLY RECONCILIATION</span>
          <h2>
            {new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <p>
            {done} of {banks.length} bank transactions resolved
          </p>
        </div>
        <div className="progress-right">
          <div>
            <strong>{progress}%</strong>
            <span>Bank review progress</span>
          </div>
          <div className="progress-track">
            <i style={{ width: progress + '%' }} />
          </div>
        </div>
        <div className="progress-counts">
          <span>
            <b>{suggestions.length}</b> suggestions
          </span>
          <span>
            <b>{banks.filter((b) => b.status === 'Partial').length}</b> partial
          </span>
          <span>
            <b>{banks.filter((b) => b.status === 'Unmatched').length}</b> unmatched
          </span>
        </div>
      </section>
      {state.statements.some((s) => s.month === month) && (
        <div className="statement-list">
          {state.statements
            .filter((s) => s.month === month)
            .map((s) => (
              <button key={s.id} className="statement-chip" onClick={() => openStatement(s)}>
                <FileText size={16} />
                {state.documents.find((d) => d.id === s.documentId)?.name || 'Statement'}
                <Badge>{s.status}</Badge>
                <ArrowRight size={15} />
              </button>
            ))}
        </div>
      )}
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>
              Suggested matches <span className="count">{suggestions.length}</span>
            </h2>
            <p>
              Automatically suggested from approved invoices and claims dated in {monthLabel(month)}
              . Confirm a suggestion to record payment. For older invoices, use Manual / split /
              combine.
            </p>
          </div>
          {canEdit && (
            <button className="button secondary" onClick={() => setManual(true)}>
              <Plus size={16} />
              Manual / split / combine
            </button>
          )}
        </div>
        <div className="match-columns">
          <span>DOCUMENTS</span>
          <span>MATCH CONFIDENCE</span>
          <span>BANK TRANSACTIONS</span>
        </div>
        {suggestions.slice(0, 15).map((s) => {
          const t = state.obligations.find((t) => t.id === s.targetId)!,
            b = state.bank.find((b) => b.id === s.bankId)!;
          return (
            <div className="suggestion-row" key={`${s.bankId}:${s.targetId}`}>
              <div className="suggestion-doc">
                <span className="file-tile">
                  <FileText size={20} />
                </span>
                <div>
                  <b>{t.party}</b>
                  <small>
                    {t.number || 'Employee claim'} · {dateLabel(t.date)}
                  </small>
                  <strong>{money(t.outstanding, t.currency)}</strong>
                </div>
              </div>
              <div className="suggestion-confidence">
                <div className="link-line" />
                <span className={s.confidence >= 80 ? 'high' : 'low'}>
                  <Sparkles size={13} />
                  {s.confidence}% match
                </span>
                <small>{s.signals.join(' · ')}</small>
              </div>
              <div className="suggestion-bank">
                <div>
                  <b>{b.description}</b>
                  <small>
                    {b.reference || 'No reference'} · {dateLabel(b.date)}
                  </small>
                  <strong>{money(b.remaining, b.currency)}</strong>
                </div>
                {canEdit && (
                  <div className="match-actions">
                    <button
                      className="button primary small-button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          action(
                            'allocation.confirm',
                            {
                              items: [
                                {
                                  bankId: s.bankId,
                                  targetId: s.targetId,
                                  targetType: s.targetType,
                                  amountMinor: s.amountMinor,
                                },
                              ],
                              reason:
                                'Human confirmed suggested match after reviewing displayed evidence',
                            },
                            'Match confirmed. Payment status updated.',
                          ),
                        )
                      }
                    >
                      <Check size={14} />
                      Confirm
                    </button>
                    <button
                      className="text-button muted"
                      disabled={busy}
                      onClick={() =>
                        run(
                          action(
                            'suggestion.reject',
                            {
                              bankId: s.bankId,
                              targetId: s.targetId,
                              reason: 'Human rejected proposed match',
                            },
                            'Suggestion rejected.',
                          ),
                        )
                      }
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!suggestions.length && (
          <Empty title="No suggested matches">
            Import a statement and approve your invoices, or choose a manual match.
          </Empty>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Bank transactions</h2>
          <a className="button secondary" href={exportLink}>
            <Download size={16} />
            Export CSV
          </a>
        </div>
        <Toolbar
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          options={[
            'All',
            'Matched',
            'Unmatched',
            'Partial',
            'Needs Review',
            'Duplicate',
            'Difference',
            'Missing Document',
          ]}
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date / description</th>
                <th>Reference</th>
                <th>Money in</th>
                <th>Money out</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.description}</b>
                    <small>{dateLabel(b.date)}</small>
                  </td>
                  <td>{b.reference || '—'}</td>
                  <td className="amount green-text">
                    {b.direction === 'in' ? money(b.amountMinor, b.currency) : '—'}
                  </td>
                  <td className="amount">
                    {b.direction === 'out' ? money(b.amountMinor, b.currency) : '—'}
                  </td>
                  <td>
                    <Badge>{b.status}</Badge>
                    {b.category && <small>{b.category}</small>}
                  </td>
                  <td>
                    {canEdit && b.status === 'Unmatched' && (
                      <button className="text-button" onClick={() => setCategoryBank(b.id)}>
                        Categorise directly
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <Empty title="No bank transactions in this view" />}
        </div>
      </section>
      {manual && (
        <Modal title="Confirm payment allocations" onClose={() => setManual(false)} wide>
          <p>
            Use several rows to split one bank payment across invoices, or combine several bank
            payments for one invoice. Enter the amount allocated on each row. All months are
            available here, including older invoices paid this month.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              const items = lines.map((l) => {
                const [targetType, targetId] = l.target.split(':');
                return { bankId: l.bankId, targetId, targetType, amount: l.amount };
              });
              void action(
                'allocation.confirm',
                {
                  items: items.map((i) => ({ ...i, amountMinor: parseMinorClient(i.amount) })),
                  reason,
                },
                'Payment allocations confirmed.',
              )
                .then(() => setManual(false))
                .catch((e) => setError(e.message));
            }}
          >
            {lines.map((line, index) => (
              <div className="allocation-row" key={index}>
                <FormField label="Bank payment">
                  <select
                    value={line.bankId}
                    required
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) => (i === index ? { ...l, bankId: e.target.value } : l)),
                      )
                    }
                  >
                    <option value="">Select bank transaction</option>
                    {state.bank
                      .filter((b) => b.remaining > 0)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.description} · {money(b.remaining, b.currency)}
                        </option>
                      ))}
                  </select>
                </FormField>
                <FormField label="Invoice / claim">
                  <select
                    value={line.target}
                    required
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) => (i === index ? { ...l, target: e.target.value } : l)),
                      )
                    }
                  >
                    <option value="">Select document</option>
                    {state.obligations.map((t) => (
                      <option key={t.id} value={`${t.type}:${t.id}`}>
                        {t.party} · {t.number || 'Claim'} · {money(t.outstanding, t.currency)}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Allocate amount">
                  <input
                    value={line.amount}
                    required
                    pattern="[0-9]+(\.[0-9]{1,2})?"
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) => (i === index ? { ...l, amount: e.target.value } : l)),
                      )
                    }
                  />
                </FormField>
                {lines.length > 1 && (
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setLines(lines.filter((_, i) => i !== index))}
                    aria-label="Remove allocation"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              className="text-button"
              type="button"
              onClick={() => setLines([...lines, { bankId: '', target: '', amount: '' }])}
            >
              <Plus size={16} />
              Add allocation
            </button>
            <FormField label="Confirmation reason">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                minLength={3}
              />
            </FormField>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <div className="notice warning">
              Confirmation records a payment. Verify the bank, document, currency and amount on
              every row.
            </div>
            <button className="button primary full" disabled={busy}>
              Confirm allocations
            </button>
          </form>
        </Modal>
      )}
      {categoryBank && (
        <Modal title="Categorise bank transaction" onClose={() => setCategoryBank('')}>
          <p>
            For charges or income without an invoice. A categorised bank transaction cannot also be
            allocated to an invoice.
          </p>
          <SimpleForm
            fields={[
              { name: 'category', label: 'Category', options: state.categories },
              { name: 'reason', label: 'Reason / missing document explanation' },
            ]}
            busy={busy}
            submit="Confirm category"
            onSubmit={async (d) => {
              await action('bank.categorise', { id: categoryBank, ...d });
              setCategoryBank('');
            }}
          />
        </Modal>
      )}
    </>
  );
}
function parseMinorClient(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
}
function InvoiceCancellation({
  invoice: i,
  canEdit,
  action,
  busy,
  onDone,
}: {
  invoice: Invoice;
  canEdit: boolean;
  action: Action;
  busy: boolean;
  onDone: () => void;
}) {
  if (i.cancellationReason)
    return <div className="notice warning">Cancelled: {i.cancellationReason}</div>;
  if (!canEdit || i.reviewStatus !== 'Approved' || i.claimId) return null;
  return (
    <details className="detail-block">
      <summary>Cancel an unpaid invoice</summary>
      <p>
        Cancellation preserves the approved original and adds a separate audit record. Paid invoices
        require a payment reversal first.
      </p>
      <SimpleForm
        fields={[{ name: 'reason', label: 'Cancellation reason (at least 10 characters)' }]}
        busy={busy}
        submit="Record cancellation"
        onSubmit={async (d) => {
          await action(
            'invoice.cancel',
            { id: i.id, reason: d.reason },
            'Invoice cancelled; original evidence preserved.',
          );
          onDone();
        }}
      />
    </details>
  );
}
function GroupSuggestions({
  state,
  month,
  action,
  canEdit,
  busy,
}: {
  state: State;
  month: string;
  action: Action;
  canEdit: boolean;
  busy: boolean;
}) {
  const [error, setError] = useState('');
  return (
    <>
      {error && <div className="form-error">{error}</div>}
      {(state.groups || [])
        .filter((g) =>
          g.items.every((i) =>
            state.bank.some((b) => b.id === i.bankId && b.date.startsWith(month)),
          ),
        )
        .map((g) => (
          <section className="panel group-suggestion" key={g.id}>
            <div className="section-heading">
              <div>
                <h2>{g.label}</h2>
                <p>Combined amounts agree. Verify each document and bank row.</p>
              </div>
              <Badge>{g.confidence}% confidence</Badge>
            </div>
            <ul>
              {g.items.map((i, index) => (
                <li key={index}>
                  <span>
                    {state.bank.find((b) => b.id === i.bankId)?.description} →{' '}
                    {state.obligations.find((t) => t.id === i.targetId)?.number ||
                      state.obligations.find((t) => t.id === i.targetId)?.party}
                  </span>
                  <b>{money(i.amountMinor, state.bank.find((b) => b.id === i.bankId)?.currency)}</b>
                </li>
              ))}
            </ul>
            {canEdit && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  setError('');
                  void action(
                    'allocation.confirm',
                    {
                      items: g.items,
                      reason: 'Human verified every item in the combined payment suggestion',
                    },
                    'Combined payment confirmed.',
                  ).catch((e) => setError(e.message));
                }}
              >
                Confirm all allocations
              </button>
            )}
          </section>
        ))}
    </>
  );
}
function ReconciliationExceptions({
  state,
  month,
  filter,
}: {
  state: State;
  month: string;
  filter: string;
}) {
  if (filter === 'Duplicate')
    return (
      <section className="panel">
        <div className="section-heading">
          <h2>Possible duplicate documents</h2>
          <p>Open Documents to review these exceptions.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Party</th>
                <th>Amount</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices
                .filter(
                  (i) =>
                    i.duplicateOf &&
                    i.reviewStatus !== 'Rejected' &&
                    (!i.invoiceDate || i.invoiceDate.startsWith(month)),
                )
                .map((i) => (
                  <tr key={i.id}>
                    <td>{i.number || i.documentName}</td>
                    <td>{i.party || 'Unknown'}</td>
                    <td>{money(i.totalMinor, i.currency || state.company.currency)}</td>
                    <td>{i.duplicateReason}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  if (filter === 'Difference')
    return (
      <section className="panel">
        <div className="section-heading">
          <h2>Receipt and statement differences</h2>
          <p>Review the related claim or statement.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Record</th>
                <th>Difference / validation</th>
              </tr>
            </thead>
            <tbody>
              {state.claims
                .filter((c) => c.month === month && c.difference !== 0)
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{money(c.difference, c.currency)}</td>
                  </tr>
                ))}
              {state.statements
                .filter(
                  (s) =>
                    s.month === month &&
                    s.status === 'Needs Review' &&
                    s.validation.errors.length > 0,
                )
                .map((s) => (
                  <tr key={s.id}>
                    <td>Bank statement · {s.month}</td>
                    <td>{s.validation.errors.slice(0, 3).join('; ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  return null;
}

// src/pages/finance/PaymentsPage.jsx — Zoho Books style
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, X, Search, Download, RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import api, { projectAPI, raBillAPI } from '../../api/client';
import dayjs from 'dayjs';
import useAuthStore from '../../store/authStore';

// ── Helpers ──────────────────────────────────────────────────────────────────
const inr = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));
const dateFmt = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';

const PAYMENT_MODES = ['RTGS', 'NEFT', 'IMPS', 'UPI', 'Cheque', 'Cash', 'DD'];
const PAYEE_TYPES   = ['Vendor', 'Contractor', 'Employee', 'Utility', 'Government', 'Other'];
const COST_HEADS = [
  { group: 'Material',         items: ['Material - Concrete & Aggregates','Material - Steel & Reinforcement','Material - Cement & Masonry','Material - Finishing & Tiles'] },
  { group: 'Labour',           items: ['Labour - Skilled','Labour - Unskilled','Labour - Supervisory'] },
  { group: 'Plant & Machinery',items: ['Plant & Machinery - Owned','Plant & Machinery - Hired'] },
  { group: 'Subcontracting',   items: ['Subcontracting - Civil','Subcontracting - MEP','Subcontracting - Structural'] },
  { group: 'Overhead',         items: ['Site Overhead','Head Office Overhead','Contingency','Provisional Sum'] },
];

const EMPTY_FORM = { project_id:'', payee_name:'', payee_type:'Vendor', description:'', amount:'', tds_rate:0, payment_mode:'RTGS', bank_ref:'', payment_date:'', cost_head:'' };

function SummaryCard({ label, value, sub, color = '#1D4ED8' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canApprove = ['super_admin', 'admin', 'managing_director'].includes(user?.role);
  const [activeTab, setActiveTab]   = useState('out');
  const [showModal, setShowModal]   = useState(false);
  const [search, setSearch]         = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [page, setPage]             = useState(1);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [sortField, setSortField]   = useState('payment_date');
  const [sortDir, setSortDir]       = useState('desc');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rawRes, refetch } = useQuery({ queryKey: ['payments'], queryFn: () => api.get('/payments').then(r => r.data) });
  const { data: projectsRes }     = useQuery({ queryKey: ['projects-simple'], queryFn: () => projectAPI.list().then(r => r.data) });
  const { data: raBillsRes }      = useQuery({ queryKey: ['ra-bills-finance'], queryFn: () => raBillAPI.list().then(r => r.data) });

  const rawPayments = Array.isArray(rawRes) ? rawRes : (Array.isArray(rawRes?.data) ? rawRes.data : []);
  const projects    = Array.isArray(projectsRes) ? projectsRes : (Array.isArray(projectsRes?.data) ? projectsRes.data : []);
  const allRaBills  = Array.isArray(raBillsRes?.data) ? raBillsRes.data : [];

  const payments = useMemo(() => rawPayments.map(p => ({
    ...p,
    display_name:   p.entity_name || p.payee_name || '—',
    project_name:   p.project_name ?? p.project ?? '—',
    reference_text: p.reference_number || p.payment_ref || p.bank_ref || '—',
    gross_amount:   Number(p.amount || 0),
    tds_amount_val: Number(p.tds_deducted ?? p.tds_amount ?? 0),
    net_amount_val: Number(p.net_amount ?? p.net_paid ?? (Number(p.amount||0) - Number(p.tds_deducted||p.tds_amount||0))),
    source_val:     p.source || (p.dqs_bill_id ? 'dqs' : 'manual'),
    mode_val:       p.payment_mode || '—',
  })), [rawPayments]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (payload) => api.post('/payments', payload),
    onSuccess: (res) => {
      qc.invalidateQueries(['payments']);
      setShowModal(false);
      setForm(EMPTY_FORM);
      if (res.data?.needs_approval) {
        toast(res.data.warning || 'Payment submitted — pending MD approval', { icon: '⚠️', duration: 6000 });
      } else {
        toast.success('Payment recorded');
      }
    },
    onError: () => toast.error('Failed to record payment'),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/payments/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['payments']); },
  });
  const approveMut = useMutation({
    mutationFn: (id) => api.patch(`/payments/${id}/approve`),
    onSuccess: () => { toast.success('Payment approved'); qc.invalidateQueries(['payments']); },
    onError: () => toast.error('Approval failed'),
  });
  const rejectMut = useMutation({
    mutationFn: (id) => api.patch(`/payments/${id}/reject`),
    onSuccess: () => { toast.success('Payment rejected'); qc.invalidateQueries(['payments']); },
    onError: () => toast.error('Rejection failed'),
  });

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = payments;
    if (projectFilter !== 'all') list = list.filter(p => p.project_id === projectFilter);
    if (modeFilter !== 'all')    list = list.filter(p => p.mode_val === modeFilter);
    if (startDate) list = list.filter(p => p.payment_date && !dayjs(p.payment_date).isBefore(dayjs(startDate), 'day'));
    if (endDate)   list = list.filter(p => p.payment_date && !dayjs(p.payment_date).isAfter(dayjs(endDate), 'day'));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => [p.display_name, p.project_name, p.reference_text, p.payment_number].some(v => String(v||'').toLowerCase().includes(s)));
    }
    return [...list].sort((a, b) => {
      let av = a[sortField], bv = b[sortField];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [payments, projectFilter, modeFilter, startDate, endDate, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const toggleSort = (f) => { if (sortField===f) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('asc'); } setPage(1); };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalGross    = filtered.reduce((s,p) => s+p.gross_amount, 0);
  const totalTds      = filtered.reduce((s,p) => s+p.tds_amount_val, 0);
  const totalNet      = filtered.reduce((s,p) => s+p.net_amount_val, 0);
  const dqsCount      = filtered.filter(p => p.source_val === 'dqs').length;
  const pendingApprovalCount = payments.filter(p => p.approval_status === 'pending_approval').length;

  // ── RA Bills tab ───────────────────────────────────────────────────────────
  const certifiedBills = allRaBills.filter(b => b.status === 'certified');
  const paidBills      = allRaBills.filter(b => b.status === 'paid');
  const raBillSource   = activeTab === 'ra' ? certifiedBills : paidBills;

  // ── CSV ────────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const h = ['Payment#','Date','Payee','Project','Mode','Reference','Gross','TDS','Net','Source'];
    const r = filtered.map(p => [p.payment_number||p.id?.slice(0,8), dateFmt(p.payment_date), p.display_name, p.project_name, p.mode_val, p.reference_text, p.gross_amount, p.tds_amount_val, p.net_amount_val, p.source_val]);
    const csv = [h,...r].map(row=>row.map(v=>`"${v}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`Payments_${dayjs().format('YYYY-MM-DD')}.csv`; a.click();
  };

  const tdsAmt = form.amount && form.tds_rate ? (Number(form.amount)*Number(form.tds_rate)/100).toFixed(0) : 0;
  const netAmt = form.amount ? (Number(form.amount)-Number(tdsAmt)) : 0;

  return (
    <div className="min-h-screen bg-[#F5F7FA] font-sans">

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Payments</h1>
          <p className="text-xs text-gray-400">Vendor disbursements and client receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-500"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50"><Download className="w-3.5 h-3.5" /> Export</button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#1D4ED8] hover:bg-blue-700 text-white text-sm font-medium"><Plus className="w-3.5 h-3.5" /> Record Payment</button>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Net Disbursed"     value={inr(totalNet)}         sub="Released to payees"      color="#059669" />
          <SummaryCard label="Gross Amount"       value={inr(totalGross)}       sub="Before TDS deduction"    color="#374151" />
          <SummaryCard label="TDS Deducted"       value={inr(totalTds)}         sub="Held at source"          color="#DC2626" />
          {pendingApprovalCount > 0 ? (
            <SummaryCard label="Pending MD Approval" value={pendingApprovalCount} sub="Large payments awaiting auth" color="#D97706" />
          ) : (
            <SummaryCard label="DQS Linked"       value={dqsCount}              sub="Auto-synced from DQS"    color="#1D4ED8" />
          )}
        </div>

        {/* Pending Approval Banner — visible to MD/Admin when there are pending payments */}
        {canApprove && pendingApprovalCount > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              {pendingApprovalCount} payment{pendingApprovalCount > 1 ? 's' : ''} pending your approval (amount &gt; ₹1L)
            </span>
            <button
              onClick={() => { setSearch(''); setProjectFilter('all'); setModeFilter('all'); }}
              className="ml-auto text-xs font-bold text-amber-600 hover:text-amber-800"
            >
              View all →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {[['out','Payments Out'],['ra','RA Bill Receipts']].map(([key,label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab===key ? 'border-[#1D4ED8] text-[#1D4ED8]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'out' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-1.5 flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search payee, reference, project…" className="text-sm outline-none w-full placeholder:text-gray-400 bg-transparent" />
              </div>
              <select value={projectFilter} onChange={e=>{setProjectFilter(e.target.value);setPage(1);}} className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 outline-none">
                <option value="all">All Projects</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={modeFilter} onChange={e=>{setModeFilter(e.target.value);setPage(1);}} className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 outline-none">
                <option value="all">All Modes</option>
                {PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <input type="date" value={startDate} onChange={e=>{setStartDate(e.target.value);setPage(1);}} className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 outline-none" />
              <input type="date" value={endDate} onChange={e=>{setEndDate(e.target.value);setPage(1);}} className="bg-white border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-600 outline-none" />
              {(search||projectFilter!=='all'||modeFilter!=='all'||startDate||endDate) && (
                <button onClick={()=>{setSearch('');setProjectFilter('all');setModeFilter('all');setStartDate('');setEndDate('');setPage(1);}} className="text-sm text-gray-400 hover:text-red-500 px-2">Clear</button>
              )}
              <div className="ml-auto text-xs text-gray-400 self-center">{filtered.length} payments</div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <button onClick={()=>toggleSort('payment_date')} className="flex items-center gap-1 hover:text-gray-700">Date <ArrowUpDown className="w-3 h-3"/></button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <button onClick={()=>toggleSort('display_name')} className="flex items-center gap-1 hover:text-gray-700">Payee <ArrowUpDown className="w-3 h-3"/></button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Project</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mode / Ref</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Gross</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">TDS</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <button onClick={()=>toggleSort('net_amount_val')} className="flex items-center gap-1 hover:text-gray-700 ml-auto">Net Paid <ArrowUpDown className="w-3 h-3"/></button>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                      <th className="px-4 py-3"/>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">No payments found</td></tr>
                    ) : paginated.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{p.payment_number || p.id?.slice(0,8).toUpperCase()}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{dateFmt(p.payment_date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 text-sm max-w-[160px] truncate">{p.display_name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{p.payee_type || p.payment_type || ''}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[130px] truncate">{p.project_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold text-gray-700">{p.mode_val}</span>
                          <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{p.reference_text}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-gray-700">{inr(p.gross_amount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-red-500">{p.tds_amount_val>0 ? inr(p.tds_amount_val) : '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-sm text-gray-900">{inr(p.net_amount_val)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.source_val==='dqs' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{p.source_val==='dqs'?'DQS':'Manual'}</span>
                            {p.approval_status === 'pending_approval' && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending Approval</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {canApprove && p.approval_status === 'pending_approval' && (
                              <>
                                <button onClick={() => approveMut.mutate(p.id)} title="Approve payment"
                                  className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => rejectMut.mutate(p.id)} title="Reject payment"
                                  className="p-1.5 rounded bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition">
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button onClick={()=>{ if(window.confirm('Delete this payment?')) deleteMut.mutate(p.id); }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {paginated.length > 0 && (
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-gray-500">Page total ({paginated.length} rows)</td>
                        <td className="px-4 py-3 text-right font-bold text-sm text-gray-800">{inr(paginated.reduce((s,p)=>s+p.gross_amount,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-sm text-red-600">{inr(paginated.reduce((s,p)=>s+p.tds_amount_val,0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-sm text-gray-900">{inr(paginated.reduce((s,p)=>s+p.net_amount_val,0))}</td>
                        <td colSpan={2}/>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="w-4 h-4"/> Previous</button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50">Next <ChevronRight className="w-4 h-4"/></button>
              </div>
            )}
          </>
        )}

        {activeTab === 'ra' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">RA Bill Receipts — Certified Bills</h3>
              <span className="text-xs text-gray-400">{certifiedBills.length} pending receipt</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Bill No.','Project','Contractor','Bill Date','Gross Amount','TDS','Net Receivable','Status'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {certifiedBills.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No certified bills pending receipt</td></tr>
                  ) : certifiedBills.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{b.bill_number || b.id?.slice(0,8)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">{b.project_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[130px] truncate">{b.contractor_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{dateFmt(b.bill_date)}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">{inr(b.gross_amount || b.net_payable)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-red-500">{inr(b.client_tds_amount || 0)}</td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-gray-900">{inr(b.net_payable || 0)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Certified</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Record Payment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-800">Record Payment</h2>
              <button onClick={()=>{setShowModal(false);setForm(EMPTY_FORM);}} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Payee Name *</label>
                  <input value={form.payee_name} onChange={e=>setForm(f=>({...f,payee_name:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Vendor or contractor name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Payee Type</label>
                  <select value={form.payee_type} onChange={e=>setForm(f=>({...f,payee_type:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none">
                    {PAYEE_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Project</label>
                  <select value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none">
                    <option value="">— Select Project —</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Payment Date *</label>
                  <input type="date" value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Gross Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">TDS Rate (%)</label>
                  <input type="number" value={form.tds_rate} onChange={e=>setForm(f=>({...f,tds_rate:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="0" />
                </div>
              </div>
              {form.amount > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                  <div className="flex justify-between text-gray-600"><span>TDS @ {form.tds_rate}%</span><span className="text-red-500">− {inr(tdsAmt)}</span></div>
                  <div className="flex justify-between font-bold text-gray-900 mt-1 pt-1 border-t border-gray-200"><span>Net Payable</span><span className="text-green-600">{inr(netAmt)}</span></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Payment Mode *</label>
                  <select value={form.payment_mode} onChange={e=>setForm(f=>({...f,payment_mode:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none">
                    {PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Bank Ref / UTR</label>
                  <input value={form.bank_ref} onChange={e=>setForm(f=>({...f,bank_ref:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Transaction reference" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Cost Head</label>
                <select value={form.cost_head} onChange={e=>setForm(f=>({...f,cost_head:e.target.value}))} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none">
                  <option value="">— Select Cost Head —</option>
                  {COST_HEADS.map(g=><optgroup key={g.group} label={g.group}>{g.items.map(i=><option key={i} value={i}>{i}</option>)}</optgroup>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Description / Remarks</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" placeholder="Payment notes…" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={()=>{setShowModal(false);setForm(EMPTY_FORM);}} className="flex-1 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                disabled={!form.payee_name||!form.amount||!form.payment_date||createMut.isPending}
                onClick={()=>createMut.mutate({ project_id:form.project_id||null, payee_name:form.payee_name, payee_type:form.payee_type, description:form.description, amount:parseFloat(form.amount), tds_rate:parseFloat(form.tds_rate||0), payment_mode:form.payment_mode, bank_ref:form.bank_ref, payment_date:form.payment_date, cost_head:form.cost_head||null })}
                className="flex-1 py-2 rounded-md bg-[#1D4ED8] hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {createMut.isPending ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

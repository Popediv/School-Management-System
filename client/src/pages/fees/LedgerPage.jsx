import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feeService } from '../../services';
import { SESSIONS } from '../../utils/constants';
import { useSettings } from '../../context/SettingsContext';
import { Search, Printer, Landmark, Briefcase, Receipt, Tag } from 'lucide-react';

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

export default function LedgerPage() {
    const { currentSession } = useSettings();
    const [session, setSession] = useState(currentSession);
    const [term, setTerm] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (currentSession) setSession(currentSession);
    }, [currentSession]);

    const { data, isLoading } = useQuery({
        queryKey: ['global-ledger', session, term],
        queryFn: () => feeService.getGlobalLedger({ session, term }).then(r => r.data),
    });

    const payments = useMemo(() => {
        if (!data?.payments) return [];
        if (!search) return data.payments;
        const q = search.toLowerCase();
        return data.payments.filter(p =>
            p.description?.toLowerCase().includes(q) ||
            p.receiptNo?.toLowerCase().includes(q) ||
            p.student?.admissionNo?.toLowerCase().includes(q) ||
            p.student?.firstName?.toLowerCase().includes(q) ||
            p.student?.lastName?.toLowerCase().includes(q)
        );
    }, [data, search]);

    const stats = data?.stats || { totalCollected: 0, byCategory: {} };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Bursar General Cashbook (Ledger)</h1>
                    <p className="page-header-subtitle">Aggregate income across all students globally.</p>
                </div>
                <button onClick={() => window.print()} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Printer size={15} /> Print Cashbook
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid-3 mb-6">
                <div className="stat-card">
                    <div className="stat-icon green"><Landmark size={22} /></div>
                    <div>
                        <div className="stat-value text-success">{fmt(stats.totalCollected)}</div>
                        <div className="stat-label">Total Cash Inflow ({session || 'All Time'})</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon indigo"><Receipt size={22} /></div>
                    <div>
                        <div className="stat-value">{payments.length}</div>
                        <div className="stat-label">Recorded Transactions</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon amber"><Briefcase size={22} /></div>
                    <div>
                        <div className="stat-value">{Object.keys(stats.byCategory || {}).length}</div>
                        <div className="stat-label">Fee Categories</div>
                    </div>
                </div>
            </div>

            {/* Category Breakdown Badges */}
            {Object.keys(stats.byCategory || {}).length > 0 && (
                <div className="card mb-4" style={{ padding: '14px 20px', background: 'var(--bg-elevated)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag size={13} /> Fee Category Inflow Breakdown
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {Object.entries(stats.byCategory).map(([cat, amount], idx) => (
                            <div key={idx} style={{ background: 'var(--bg-body)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="text-secondary font-medium">{cat}:</span>
                                <span className="font-bold text-success">{fmt(amount)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="card mb-4" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                        <Search size={16} />
                        <input className="form-input" placeholder="Search by student name, admission no, or receipt..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="form-select" style={{ width: 140 }} value={term} onChange={e => setTerm(e.target.value)}>
                        <option value="">All Terms</option>
                        <option value="FIRST">First Term</option>
                        <option value="SECOND">Second Term</option>
                        <option value="THIRD">Third Term</option>
                    </select>
                    <select className="form-select" style={{ width: 140 }} value={session} onChange={e => setSession(e.target.value)}>
                        <option value="">All Sessions</option>
                        {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Receipt No</th>
                                <th>Student</th>
                                <th>Class</th>
                                <th>Category / Description</th>
                                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                                <th>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="text-center text-muted py-8">Loading ledger records...</td>
                                </tr>
                            ) : payments.length > 0 ? (
                                payments.map(p => (
                                    <tr key={p.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(p.paidAt || p.createdAt).toLocaleDateString()}</td>
                                        <td><code style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>{p.receiptNo}</code></td>
                                        <td>
                                            <strong style={{ color: 'var(--text-primary)' }}>{p.student?.lastName} {p.student?.firstName}</strong>
                                            <div className="text-xs text-muted">{p.student?.admissionNo}</div>
                                        </td>
                                        <td>{p.student?.currentClass?.name || '—'}</td>
                                        <td>{p.description}</td>
                                        <td style={{ textAlign: 'right' }} className="text-success font-semibold">{fmt(p.amountPaid)}</td>
                                        <td><span className="badge badge-info text-xs">{p.paymentMethod || 'CASH'}</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="text-center text-muted py-8">No payments found matching the selected filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookMarked, ClipboardCheck, CreditCard, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const EMPTY = {
  child: null,
  attendance: { present: 0, absent: 0, late: 0, rate: 0 },
  termResult: { avg: null, position: null },
  feeBalance: { outstanding: 0 },
  notifications: [],
};

export default function ParentDashboard() {
  const { user } = useAuth();
  const { data: stats = EMPTY, isLoading } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => api.get('/dashboard/parent-stats').then(r => r.data),
    placeholderData: EMPTY,
  });
  const { child, attendance, termResult, feeBalance, notifications, payments } = stats;
  const initials = child?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const attendTotal = (attendance?.present || 0) + (attendance?.absent || 0) + (attendance?.late || 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Parent Portal</h1>
          <p className="page-header-subtitle">Monitor your child's academic progress and school updates</p>
        </div>
      </div>

      {/* Child Banner */}
      {child ? (
        <div className="card mb-6" style={{ background:'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(6,182,212,0.05))', border:'1px solid rgba(79,70,229,0.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            <div style={{ width:64, height:76, borderRadius:'var(--radius-md)', background:'linear-gradient(135deg,var(--primary),var(--secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', fontWeight:700, color:'white', flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ flex:1 }}>
              <h2 style={{ marginBottom:4 }}>{child.name}</h2>
              <code style={{ fontSize:'0.82rem', color:'var(--primary-light)', background:'rgba(79,70,229,0.1)', padding:'2px 10px', borderRadius:99 }}>{child.admissionNo}</code>
              <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
                <span className="text-sm text-muted">Class: <strong className="text-primary">{child.class}</strong></span>
                <span className="text-sm text-muted">Session: <strong className="text-primary">{child.session}</strong></span>
              </div>
            </div>
            <Link to="/schemes" className="btn btn-secondary btn-sm"><BookMarked size={13}/> Scheme of Work</Link>
          </div>
        </div>
      ) : (
        <div className="card mb-6 text-center py-8">
          <p className="text-muted">No student profile linked to your account yet.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid-stat mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><ClipboardCheck size={22}/></div>
          <div>
            <div className="stat-value">{attendance?.rate ?? 0}%</div>
            <div className="stat-label">Attendance Rate</div>
            <div className="stat-change up">↑ {attendance?.present} days present</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon indigo"><BookMarked size={22}/></div>
          <div>
            <div className="stat-value">{termResult?.avg ?? '—'}</div>
            <div className="stat-label">Term Average</div>
            <div className="stat-change up">Position: {termResult?.position}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${feeBalance?.outstanding > 0 ? 'red' : 'green'}`}><CreditCard size={22}/></div>
          <div>
            <div className="stat-value">₦{(feeBalance?.outstanding || 0).toLocaleString()}</div>
            <div className="stat-label">Outstanding Fees</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><AlertCircle size={22}/></div>
          <div>
            <div className="stat-value">{attendance?.absent ?? 0}</div>
            <div className="stat-label">Days Absent</div>
            <div className="stat-change" style={{ color:'var(--text-muted)' }}>This term</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Attendance Bars */}
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Attendance Breakdown</h3>
          {[
            { label:'Present', value:attendance?.present || 0, color:'var(--success)' },
            { label:'Absent',  value:attendance?.absent  || 0, color:'var(--danger)'  },
            { label:'Late',    value:attendance?.late    || 0, color:'var(--accent)'  },
          ].map(({ label, value, color }) => {
            const pct = attendTotal ? Math.round(value / attendTotal * 100) : 0;
            return (
              <div key={label} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                  <span className="text-sm text-secondary">{label}</span>
                  <span className="text-sm font-semibold" style={{ color }}>{value} days ({pct}%)</span>
                </div>
                <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99 }}/>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3>School Notices</h3>
            <Link to="/notifications" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {(notifications || []).map(n => (
            <div key={n.id} style={{ padding:'12px 0', borderBottom:'1px solid var(--border-light)' }}>
              <div className="font-semibold text-primary text-sm">{n.title}</div>
              <p className="text-xs text-muted" style={{ marginTop:3, lineHeight:1.5 }}>{n.message}</p>
              <div className="text-xs text-muted mt-1">{n.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee Statements */}
      <div className="card mt-6" style={{ padding:0 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <h3>Fee Statements & Receipts</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Date</th><th>Description</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              {(payments || []).map(p => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td><strong>{p.description}</strong></td>
                  <td>₦{p.amount?.toLocaleString()}</td>
                  <td className="text-success">₦{p.amountPaid?.toLocaleString()}</td>
                  <td className={p.balance > 0 ? "text-danger font-semibold" : "text-muted"}>₦{p.balance?.toLocaleString()}</td>
                  <td><span className={`badge ${p.status === 'PAID' ? 'badge-success' : p.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>{p.status}</span></td>
                  <td>
                    {p.status !== 'PENDING' && (
                      <Link to={`/fees/receipt/${p.id}`} className="btn btn-secondary btn-sm">Receipt</Link>
                    )}
                  </td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr><td colSpan="7" className="text-center text-muted py-8">No fee records found for your child.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

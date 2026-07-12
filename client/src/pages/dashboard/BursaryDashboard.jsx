import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CreditCard, GraduationCap, AlertCircle, TrendingUp,
  ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import api from '../../services/api';

const EMPTY_STATS = {
  totalOutstanding: 0,
  totalCollected:   0,
  pendingInvoices:  0,
  paidToday:        0,
  recentPayments:   [],
  monthlyChart:     [],
};

const fmt = (n) => `₦${Number(n).toLocaleString()}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div className="card card-sm" style={{ padding:'8px 14px', fontSize:'0.8rem' }}>
      <div className="font-semibold text-primary mb-1">{label}</div>
      <div style={{ color:'var(--primary-light)' }}>Collected: {fmt(payload[0].value)}</div>
    </div>
  );
  return null;
};

export default function BursaryDashboard() {
  const { data: stats = EMPTY_STATS, isLoading } = useQuery({
    queryKey: ['bursary-stats'],
    queryFn: () => api.get('/dashboard/bursary-stats').then(r => r.data),
    placeholderData: EMPTY_STATS,
  });

  const statCards = [
    { label:'Total Outstanding', value: fmt(stats.totalOutstanding), icon: AlertCircle, color:'red'   },
    { label:'Collected This Term',value: fmt(stats.totalCollected),  icon: TrendingUp,  color:'green' },
    { label:'Pending Invoices',   value: stats.pendingInvoices,      icon: Clock,       color:'amber' },
    { label:'Paid Today',         value: stats.paidToday,            icon: CheckCircle, color:'cyan'  },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Bursary Dashboard</h1>
          <p className="page-header-subtitle">Fee collection overview and payment records</p>
        </div>
        <Link to="/fees" className="btn btn-primary">
          <CreditCard size={16}/> Manage Fees
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-stat mb-6">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card card-hover">
            <div className={`stat-icon ${color}`}><Icon size={22}/></div>
            <div>
              {isLoading
                ? <div className="skeleton" style={{ height:28, width:100, marginBottom:6 }}/>
                : <div className="stat-value" style={{ fontSize: value.toString().length > 8 ? '1.3rem' : '1.75rem' }}>{value}</div>
              }
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-6">
        {/* Collections Chart */}
        <div className="card">
          <h3 style={{ marginBottom:20 }}>Monthly Collections</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.monthlyChart || []}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000000).toFixed(1)}M`}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="collected" radius={[6,6,0,0]}>
                {(stats.monthlyChart || []).map((_, i, arr) => (
                  <Cell key={i} fill={i === arr.length - 1 ? 'var(--primary)' : 'var(--bg-elevated)'}
                    stroke={i === arr.length - 1 ? 'none' : 'var(--border)'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div>
          <h3 style={{ marginBottom:16 }}>Quick Actions</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'View All Fees',      desc:'See all outstanding invoices',    to:'/fees',     icon:CreditCard    },
              { label:'Search Students',    desc:'Find a student and their balance', to:'/students', icon:GraduationCap },
            ].map(a => (
              <Link key={a.to} to={a.to} style={{ textDecoration:'none' }}>
                <div className="card card-hover" style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer' }}>
                  <div className="stat-icon indigo"><a.icon size={20}/></div>
                  <div style={{ flex:1 }}>
                    <div className="font-semibold text-primary text-sm">{a.label}</div>
                    <div className="text-xs text-muted">{a.desc}</div>
                  </div>
                  <ArrowRight size={16} style={{ color:'var(--text-muted)' }}/>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3>Recent Payments</h3>
          <Link to="/fees" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Student</th><th>Admission No.</th><th>Type</th><th>Amount</th><th>Date</th><th>Status</th>
            </tr></thead>
            <tbody>
              {(stats.recentPayments || []).map(p => (
                <tr key={p.id}>
                  <td><strong>{p.studentName}</strong></td>
                  <td><code style={{ fontSize:'0.8rem', color:'var(--primary-light)' }}>{p.admissionNo}</code></td>
                  <td>{p.type}</td>
                  <td style={{ color:'var(--success)', fontWeight:600 }}>{fmt(p.amount)}</td>
                  <td className="text-muted">{p.date}</td>
                  <td>
                    <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
              {!isLoading && (stats.recentPayments || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>
                    No recent payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

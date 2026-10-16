import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookMarked, ClipboardCheck, BookOpen, Award } from 'lucide-react';
import api from '../../services/api';

const EMPTY = {
  student: null,
  attendance: { rate: 0, present: 0, absent: 0, late: 0 },
  results: [],
  position: '—',
  avg: '—',
  notifications: [],
  feeBalance: { outstanding: 0 },
};

const GRADE_COLOR = { A:'success', B:'info', C:'warning', D:'danger', F:'danger' };

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data: stats = EMPTY, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api.get('/dashboard/student-stats').then(r => r.data),
    placeholderData: EMPTY,
  });
  const { student, attendance, results, position, avg, notifications, feeBalance, payments } = stats;
  const initials = student?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Student Portal</h1>
          <p className="page-header-subtitle">Your academic overview for {student?.session}</p>
        </div>
        <Link to="/schemes" className="btn btn-primary"><BookOpen size={16}/> Scheme of Work</Link>
      </div>

      {/* Student Banner */}
      {student ? (
        <div className="card mb-6" style={{ background:'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(6,182,212,0.05))', border:'1px solid rgba(79,70,229,0.2)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            {student.photo ? (
              <img
                src={student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`}
                alt={student.name}
                style={{
                  width: 68,
                  height: 76,
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'cover',
                  border: '2px solid rgba(79,70,229,0.3)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  flexShrink: 0
                }}
                onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              style={{
                width: 68,
                height: 76,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg,var(--primary),var(--secondary))',
                display: student.photo ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: 'white',
                flexShrink: 0
              }}
            >
              {initials}
            </div>
            <div>
              <h2 style={{ marginBottom:4 }}>{student.name}</h2>
              <code style={{ fontSize:'0.82rem', color:'var(--primary-light)', background:'rgba(79,70,229,0.1)', padding:'2px 10px', borderRadius:99 }}>{student.admissionNo}</code>
              <div style={{ display:'flex', gap:16, marginTop:8, flexWrap:'wrap' }}>
                <span className="text-sm text-muted">Class: <strong className="text-primary">{student.class}</strong></span>
                <span className="text-sm text-muted">Class Position: <strong className="text-primary">{position}</strong></span>
                <span className="text-sm text-muted">Attendance Score: <strong className="text-success">{attendance?.display || `${attendance?.score ?? 0}/10`}</strong></span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-6 text-center py-8">
          <p className="text-muted">No student profile linked to your user account.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid-stat mb-6">
        <div className="stat-card">
          <div className="stat-icon green"><ClipboardCheck size={22}/></div>
          <div>
            <div className="stat-value">{attendance?.display || `${attendance?.score ?? 0}/10`}</div>
            <div className="stat-label">Attendance Score ({attendance?.rate ?? 0}%)</div>
            <div className="stat-change up">↑ {attendance?.present} days present</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon indigo"><Award size={22}/></div>
          <div>
            <div className="stat-value">{avg ?? '—'}</div>
            <div className="stat-label">Term Average</div>
            <div className="stat-change up">Position: {position}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><BookMarked size={22}/></div>
          <div>
            <div className="stat-value">{results?.length ?? 0}</div>
            <div className="stat-label">Subjects Taken</div>
          </div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${feeBalance?.outstanding > 0 ? 'red' : 'green'}`}><Award size={22}/></div>
          <div>
            <div className="stat-value">₦{(feeBalance?.outstanding || 0).toLocaleString()}</div>
            <div className="stat-label">Outstanding Fees</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Results Table */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h3 style={{ margin:0 }}>Term Results</h3>
              <p className="text-xs text-muted" style={{ margin:'2px 0 0' }}>Showing CA, Attendance, and Class Positions</p>
            </div>
            {student?.class && (
              <span className="badge badge-indigo">{student.class}</span>
            )}
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Subject</th>
                <th>CA</th>
                <th>Attendance</th>
                <th>Total CA</th>
                <th>Exam</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Position</th>
              </tr></thead>
              <tbody>
                {(results || []).map(r => (
                  <tr key={r.id || r.subject}>
                    <td>
                      <strong>{r.subject}</strong>
                      {r.code && <div className="text-xs text-muted">{r.code}</div>}
                    </td>
                    <td>{r.ca}</td>
                    <td style={{ color:'var(--primary)', fontWeight:600 }}>{r.attendanceScoreDisplay || `${r.attendanceScore ?? 0}/10`}</td>
                    <td style={{ fontWeight:600 }}>{r.totalCa ?? (r.ca + (r.attendanceScore || 0))}</td>
                    <td>{r.exam}</td>
                    <td><strong style={{ fontSize:'1rem' }}>{r.total}</strong></td>
                    <td><span className={`badge badge-${GRADE_COLOR[r.grade?.[0]] || 'muted'}`}>{r.grade}</span></td>
                    <td>
                      <span className="badge badge-info" style={{ fontWeight:700 }}>
                        {r.positionOf || r.position || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!results || results.length === 0) && (
                  <tr>
                    <td colSpan="8" className="text-center text-muted py-8">
                      {stats.resultsReleased === false ? (
                        <div style={{ padding: '24px 16px', maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
                          <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🔒</div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: 6 }}>
                            Results Pending Administrative Release
                          </div>
                          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                            Academic results for this term have not yet been officially released by the school administration. Please check back later.
                          </p>
                        </div>
                      ) : (
                        "No results uploaded for this term yet."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3>Notices</h3>
            <Link to="/notifications" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {(notifications || []).map(n => (
            <div key={n.id} style={{ padding:'12px 0', borderBottom:'1px solid var(--border-light)' }}>
              <div className="font-semibold text-primary text-sm">{n.title}</div>
              <p className="text-xs text-muted" style={{ marginTop:3, lineHeight:1.5 }}>{n.message}</p>
              <div className="text-xs text-muted mt-1">{n.date}</div>
            </div>
          ))}
          {(!notifications || notifications.length === 0) && (
            <p className="text-muted">No new notices.</p>
          )}
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
                <tr><td colSpan="7" className="text-center text-muted py-8">No fee records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

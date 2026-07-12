import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ClipboardCheck, BookMarked, GraduationCap, ArrowRight,
  CheckCircle, XCircle, Clock, BookOpen
} from 'lucide-react';
import api from '../../services/api';

const DEMO = {
  myClasses: [
    { id:'c1', name:'JSS1A', subject:'Mathematics', students:38 },
    { id:'c2', name:'SS2B',  subject:'Further Maths', students:30 },
  ],
  attendanceSummary: { present:68, absent:5, late:3 },
  pendingResults: 2,
  recentAttendance: [
    { date:'2026-05-19', class:'JSS1A', present:36, absent:2, late:0 },
    { date:'2026-05-16', class:'SS2B',  present:28, absent:1, late:1 },
  ],
};

export default function TeacherDashboard() {
  const { user } = useAuth();

  const { data: stats = DEMO } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => api.get('/dashboard/teacher-stats').then(r => r.data).catch(() => DEMO),
    placeholderData: DEMO,
  });

  const QUICK = [
    { label:'Mark Attendance', desc:"Record today's class attendance",    to:'/attendance/mark',  icon:ClipboardCheck },
    { label:'Upload Results',  desc:'Enter CA and exam scores for a subject', to:'/results/upload', icon:BookMarked     },
    { label:'My Students',     desc:'Browse students in your classes',     to:'/students',         icon:GraduationCap  },
    { label:'Scheme of Work',  desc:'View / upload teaching schemes',      to:'/schemes',          icon:BookOpen       },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Welcome back, {user?.name?.split(' ')[0] || 'Teacher'}!</h1>
          <p className="page-header-subtitle">Here's your classroom summary for today.</p>
        </div>
        <Link to="/attendance/mark" className="btn btn-primary">
          <ClipboardCheck size={16}/> Mark Today's Attendance
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-stat mb-6">
        <div className="stat-card">
          <div className="stat-icon indigo"><GraduationCap size={22}/></div>
          <div>
            <div className="stat-value">{stats.myClasses?.length || 0}</div>
            <div className="stat-label">My Classes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={22}/></div>
          <div>
            <div className="stat-value">{stats.attendanceSummary?.present || 0}</div>
            <div className="stat-label">Present Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><XCircle size={22}/></div>
          <div>
            <div className="stat-value">{stats.attendanceSummary?.absent || 0}</div>
            <div className="stat-label">Absent Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><BookMarked size={22}/></div>
          <div>
            <div className="stat-value">{stats.pendingResults || 0}</div>
            <div className="stat-label">Pending Results</div>
          </div>
        </div>
      </div>

      <div className="grid-2 mb-6">
        {/* My Classes */}
        <div className="card">
          <h3 style={{ marginBottom:16 }}>My Classes</h3>
          {(stats.myClasses || []).length === 0
            ? <p className="text-muted">No classes assigned yet.</p>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {stats.myClasses.map(c => (
                  <div key={c.id} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', borderRadius:'var(--radius-md)',
                    background:'var(--bg-elevated)', border:'1px solid var(--border)'
                  }}>
                    <div>
                      <div className="font-semibold text-primary">{c.name}</div>
                      <div className="text-xs text-muted">{c.subject} · {c.students} students</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <Link to={`/attendance/mark?class=${c.id}`} className="btn btn-secondary btn-sm">
                        <ClipboardCheck size={12}/> Attend
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Quick Actions */}
        <div>
          <h3 style={{ marginBottom:16 }}>Quick Actions</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {QUICK.map(a => (
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

      {/* Recent Attendance */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3>Recent Attendance Records</h3>
          <Link to="/attendance/report" className="btn btn-secondary btn-sm">View Reports</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Date</th><th>Class</th>
              <th style={{ color:'var(--success)' }}>Present</th>
              <th style={{ color:'var(--danger)'  }}>Absent</th>
              <th style={{ color:'var(--accent)'  }}>Late</th>
              <th>Rate</th>
            </tr></thead>
            <tbody>
              {(stats.recentAttendance || []).map((r, i) => {
                const total = r.present + r.absent + r.late;
                const rate  = total ? Math.round((r.present / total) * 100) : 0;
                return (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td><strong>{r.class}</strong></td>
                    <td style={{ color:'var(--success)', fontWeight:600 }}>{r.present}</td>
                    <td style={{ color:'var(--danger)',  fontWeight:600 }}>{r.absent}</td>
                    <td style={{ color:'var(--accent)',  fontWeight:600 }}>{r.late}</td>
                    <td><span className={`badge ${rate >= 75 ? 'badge-success' : rate >= 50 ? 'badge-warning' : 'badge-danger'}`}>{rate}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

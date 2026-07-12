import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GraduationCap, UserCog, School, BookOpen,
  ClipboardCheck, TrendingUp, ArrowRight, Award
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import api from '../../services/api';

const DEMO = {
  totalStudents: 412, totalTeachers: 28, totalClasses: 18, totalSubjects: 14,
  attendanceSummary: { present: 374, absent: 28, late: 10 },
  topSubjects: [
    { name:'Mathematics', avgScore:72 }, { name:'English Language', avgScore:68 },
    { name:'Physics', avgScore:65 },     { name:'Chemistry', avgScore:61 },
    { name:'Biology', avgScore:74 },
  ],
  enrollmentChart: [
    { month:'Jan', students:380 }, { month:'Feb', students:390 },
    { month:'Mar', students:398 }, { month:'Apr', students:405 }, { month:'May', students:412 },
  ],
  teacherAssignments: [
    { id:'t1', teacher:{ user:{ name:'Mr. Okafor Emmanuel' } }, subject:{ name:'Mathematics' },    class:{ name:'SS2A' } },
    { id:'t2', teacher:{ user:{ name:'Mrs. Adaku Nwosu'    } }, subject:{ name:'English Language' },class:{ name:'JSS3B' } },
    { id:'t3', teacher:{ user:{ name:'Mr. Tunde Alabi'     } }, subject:{ name:'Physics' },         class:{ name:'SS1A' } },
  ],
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div className="card card-sm" style={{ padding:'8px 14px', fontSize:'0.8rem' }}>
      <div className="font-semibold text-primary mb-1">{label}</div>
      {payload.map(p => <div key={p.name} style={{ color:p.color }}>{p.name}: {p.value}</div>)}
    </div>
  );
  return null;
};

export default function PrincipalDashboard() {
  const { data: stats = DEMO, isLoading } = useQuery({
    queryKey: ['principal-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data).catch(() => DEMO),
    placeholderData: DEMO,
  });

  const total = (stats.attendanceSummary?.present || 0) + (stats.attendanceSummary?.absent || 0) + (stats.attendanceSummary?.late || 0);
  const attRate = total ? Math.round(((stats.attendanceSummary?.present || 0) / total) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Principal Dashboard</h1>
          <p className="page-header-subtitle">Academic overview and performance metrics for this term</p>
        </div>
        <Link to="/students" className="btn btn-primary"><GraduationCap size={16}/> View Students</Link>
      </div>

      {/* Stats */}
      <div className="grid-stat mb-6">
        {[
          { label:'Total Students',  value: stats.totalStudents,  icon: GraduationCap, color:'indigo' },
          { label:'Teaching Staff',  value: stats.totalTeachers,  icon: UserCog,       color:'cyan'   },
          { label:'Active Classes',  value: stats.totalClasses,   icon: School,        color:'amber'  },
          { label:'Subjects Offered',value: stats.totalSubjects,  icon: BookOpen,      color:'green'  },
          { label:'Attendance Rate', value: `${attRate}%`,        icon: ClipboardCheck,color:'green'  },
        ].map(({ label, value, icon:Icon, color }) => (
          <div key={label} className="stat-card card-hover">
            <div className={`stat-icon ${color}`}><Icon size={22}/></div>
            <div>
              {isLoading
                ? <div className="skeleton" style={{ height:28, width:80, marginBottom:6 }}/>
                : <div className="stat-value">{value ?? '—'}</div>
              }
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-6">
        {/* Enrollment Chart */}
        <div className="card">
          <h3 style={{ marginBottom:20 }}>Student Enrolment Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.enrollmentChart || []}>
              <defs>
                <linearGradient id="gradPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="month" tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:12 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="students" name="Students"
                stroke="var(--primary)" strokeWidth={2} fill="url(#gradPrincipal)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance Summary */}
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Attendance Summary (Today)</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'Present', value: stats.attendanceSummary?.present, color:'var(--success)',      pct: total ? Math.round((stats.attendanceSummary?.present || 0)/total*100) : 0 },
              { label:'Absent',  value: stats.attendanceSummary?.absent,  color:'var(--danger)',       pct: total ? Math.round((stats.attendanceSummary?.absent  || 0)/total*100) : 0 },
              { label:'Late',    value: stats.attendanceSummary?.late,    color:'var(--accent)',       pct: total ? Math.round((stats.attendanceSummary?.late    || 0)/total*100) : 0 },
            ].map(({ label, value, color, pct }) => (
              <div key={label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span className="text-sm text-secondary">{label}</span>
                  <span className="text-sm font-semibold" style={{ color }}>{value ?? 0} <span className="text-muted">({pct}%)</span></span>
                </div>
                <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width 0.6s ease' }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="divider"/>
          <Link to="/attendance/report" className="btn btn-secondary btn-sm w-full" style={{ justifyContent:'center' }}>
            View Full Reports
          </Link>
        </div>
      </div>

      <div className="grid-2">
        {/* Teacher Assignments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3>Teacher Assignments</h3>
            <Link to="/teachers" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {(stats.teacherAssignments || []).length === 0
            ? <p className="text-muted">No assignments recorded yet.</p>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {stats.teacherAssignments.map((t, i) => (
                  <div key={t.id} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 0',
                    borderBottom: i < stats.teacherAssignments.length - 1 ? '1px solid var(--border-light)' : 'none'
                  }}>
                    <div className="avatar-placeholder avatar-sm" style={{ fontSize:'0.7rem', flexShrink:0 }}>
                      {t.teacher?.user?.name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div className="text-sm font-semibold text-primary">{t.teacher?.user?.name}</div>
                      <div className="text-xs text-muted">{t.subject?.name} — {t.class?.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

        {/* Top Subjects by Score */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3>Subject Averages</h3>
            <Award size={18} style={{ color:'var(--accent)' }}/>
          </div>
          {(stats.topSubjects || []).map((s, i) => (
            <div key={s.name} style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span className="text-sm text-secondary">{s.name}</span>
                <span className="text-sm font-semibold text-primary">{s.avgScore}%</span>
              </div>
              <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${s.avgScore}%`, borderRadius:99, transition:'width 0.6s ease',
                  background:`linear-gradient(90deg, var(--primary), var(--secondary))` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GraduationCap, UserCog, School, CreditCard,
  TrendingUp, ClipboardCheck, UserPlus, ArrowRight,
  Upload, CheckCircle2, AlertCircle, Lock, Unlock
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import api from '../../services/api';
import { SESSIONS } from '../../utils/constants';

/* ── Stat Card ── */
function StatCard({ label, value, icon: Icon, color, loading }) {
  // Use strictly `??` so that if the DB returns exactly 0, it renders "0" instead of "—"
  const displayValue = value ?? '—';

  return (
    <div className="stat-card card-hover">
      <div className={`stat-icon ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        {loading ? (
          <div className="skeleton" style={{ height: 28, width: 80, marginBottom: 6 }} />
        ) : (
          <div className="stat-value">{displayValue}</div>
        )}
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

/* ── Quick Action ── */
function QuickAction({ label, to, icon: Icon, desc }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className="card card-hover" style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
        <div className="stat-icon indigo"><Icon size={20} /></div>
        <div style={{ flex: 1 }}>
          <div className="font-semibold text-primary text-sm">{label}</div>
          <div className="text-xs text-muted">{desc}</div>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
      </div>
    </Link>
  );
}

/* ── Chart Tooltip ── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="card card-sm" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
        <div className="font-semibold text-primary mb-1">{label}</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  }
  return null;
}

/* ── School Settings Component ── */
function SchoolSettingsCard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data)
  });

  const [admissionPrefix, setAdmissionPrefix] = useState('');
  const [admissionStartingSequence, setAdmissionStartingSequence] = useState(1);
  const [currentSession, setCurrentSession] = useState('2026/2027');
  const [currentTerm, setCurrentTerm] = useState('FIRST');
  const [resultsReleased, setResultsReleased] = useState(false);

  // Sync state with settings
  React.useEffect(() => {
    if (settings) {
      if (settings.admissionPrefix) setAdmissionPrefix(settings.admissionPrefix);
      if (settings.admissionStartingSequence) setAdmissionStartingSequence(settings.admissionStartingSequence);
      if (settings.currentSession) setCurrentSession(settings.currentSession);
      if (settings.currentTerm) setCurrentTerm(settings.currentTerm);
      if (settings.resultsReleased !== undefined) setResultsReleased(Boolean(settings.resultsReleased));
    }
  }, [settings]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.post('/settings', { admissionPrefix, admissionStartingSequence, currentSession, currentTerm, resultsReleased });
      toast.success('Configuration saved!');
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleReleaseFromCard = async (checked) => {
    setResultsReleased(checked);
    try {
      await api.post('/settings', { resultsReleased: checked, currentSession, currentTerm });
      toast.success(checked ? 'Results released to students & parents!' : 'Results withheld from students.');
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (err) {
      toast.error('Failed to update release status');
      setResultsReleased(!checked);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      await api.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('School logo uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to upload logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card" style={{ height: '100%' }}>
      <h3 style={{ marginBottom: 16 }}>School Identity</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
        Customize the branding of your school. This logo will appear globally on the login screen, sidebar, student ID cards, and admission letters.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          border: '2px dashed var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative', background: 'var(--background)'
        }}>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="School Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>No Logo</span>
          )}
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
        >
          <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload Logo'}
        </button>
        <input
          ref={fileInputRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleLogoUpload}
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
        <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
          <span>Active School Name:</span>
        </div>
        <div className="text-sm font-bold mt-1" style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>
          {settings?.schoolName || 'Not Set'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
        <h4 style={{ marginBottom: 12, fontSize: '0.9rem' }}>Global Academic Calendar</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Active Session</label>
            <select className="form-select" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={currentSession} onChange={e => setCurrentSession(e.target.value)}>
              {SESSIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Active Term</label>
            <select className="form-select" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={currentTerm} onChange={e => setCurrentTerm(e.target.value)}>
              <option value="FIRST">First Term</option>
              <option value="SECOND">Second Term</option>
              <option value="THIRD">Third Term</option>
            </select>
          </div>
        </div>

        {/* Results Release Control in School Settings Card */}
        <div style={{
          marginTop: 14,
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: resultsReleased ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${resultsReleased ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: resultsReleased ? '#059669' : '#b45309' }}>
              {resultsReleased ? '✓ Results are Released' : '🔒 Results are Withheld'}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={resultsReleased}
                onChange={e => handleToggleReleaseFromCard(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Release Result</span>
            </label>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            {resultsReleased
              ? 'Checked: Students and parents can view term scores, attendance, and positions.'
              : 'Unchecked: Scores are hidden from student portal until you release them.'}
          </p>
        </div>

        <h4 style={{ marginBottom: 12, marginTop: 16, fontSize: '0.9rem' }}>Admission Number Configuration</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Prefix</label>
            <input type="text" className="form-input" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={admissionPrefix} onChange={e => setAdmissionPrefix(e.target.value)} placeholder="e.g. PCI-2026-" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Starting Number</label>
            <input type="number" min="1" className="form-input" style={{ padding: '6px 12px', fontSize: '0.85rem' }} value={admissionStartingSequence} onChange={e => setAdmissionStartingSequence(e.target.value)} placeholder="e.g. 1" />
          </div>
          <button className="btn btn-primary btn-sm mt-2" onClick={handleSaveConfig} disabled={savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard Component ── */
export default function AdminDashboard() {
  const queryClient = useQueryClient();

  // Fetching stats
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
  });

  // Fetching global settings for release toggle
  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const resultsReleased = Boolean(settings?.resultsReleased);
  const [togglingRelease, setTogglingRelease] = useState(false);

  const handleToggleRelease = async () => {
    const nextState = !resultsReleased;
    setTogglingRelease(true);
    try {
      await api.post('/settings', { resultsReleased: nextState });
      toast.success(nextState ? '🎉 Results have been released to students & parents!' : '🔒 Results are now withheld from student/parent view.');
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (err) {
      toast.error('Failed to update result release status');
    } finally {
      setTogglingRelease(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Admin Dashboard</h1>
          <p className="page-header-subtitle">
            Welcome back — here's what's happening at your school today.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Release Result Interactive Button */}
          <button
            type="button"
            className="btn"
            onClick={handleToggleRelease}
            disabled={togglingRelease}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 24,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: resultsReleased ? '1px solid #10b981' : '1px solid var(--border)',
              background: resultsReleased ? 'rgba(16,185,129,0.12)' : 'var(--card-bg, #fff)',
              color: resultsReleased ? '#059669' : 'var(--text-primary)',
              boxShadow: resultsReleased ? '0 2px 8px rgba(16,185,129,0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}
            title={resultsReleased ? 'Results are currently released. Click to withhold.' : 'Results are withheld. Click to release to students.'}
          >
            <input
              type="checkbox"
              checked={resultsReleased}
              onChange={() => {}} // Handled by button onClick
              style={{
                width: 16,
                height: 16,
                accentColor: '#10b981',
                cursor: 'pointer',
                pointerEvents: 'none',
              }}
            />
            {resultsReleased ? (
              <>
                <Unlock size={15} style={{ color: '#059669' }} />
                <span>Results Released</span>
              </>
            ) : (
              <>
                <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                <span>Release Result</span>
              </>
            )}
          </button>

          <Link to="/students/register" className="btn btn-primary">
            <UserPlus size={16} /> Register Student
          </Link>
        </div>
      </div>

      {/* Error State Banner */}
      {isError && (
        <div className="card mb-6" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <AlertCircle style={{ color: 'var(--danger)' }} size={24} />
          <div style={{ color: 'var(--danger-dark)' }}>
            <strong>Failed to load dashboard data.</strong> Check your network connection or ensure the server is running.
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid-stat mb-6">
        <StatCard label="Total Students" value={stats?.students} icon={GraduationCap} color="indigo" loading={isLoading} />
        <StatCard label="Teaching Staff" value={stats?.teachers} icon={UserCog} color="cyan" loading={isLoading} />
        <StatCard label="Active Classes" value={stats?.classes} icon={School} color="amber" loading={isLoading} />
        <StatCard label="Attendance Rate" value={stats?.attendanceRate !== undefined ? `${stats.attendanceRate}%` : undefined} icon={ClipboardCheck} color="green" loading={isLoading} />
        <StatCard label="Outstanding Fees" value={stats?.outstandingFees !== undefined ? `₦${stats.outstandingFees.toLocaleString()}` : undefined} icon={CreditCard} color="red" loading={isLoading} />
        <StatCard label="New This Term" value={stats?.newThisTerm} icon={TrendingUp} color="indigo" loading={isLoading} />
      </div>

      {/* Charts + Quick Actions */}
      <div className="grid-2 mb-6">
        {/* Enrolment Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 20 }}>Student Enrolment Trend</h3>
          {isLoading ? (
            <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 8 }} />
          ) : stats?.enrollmentChart?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats.enrollmentChart}>
                <defs>
                  <linearGradient id="gradStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="students" name="Students"
                  stroke="var(--primary)" strokeWidth={2}
                  fill="url(#gradStudents)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No enrolment data available.
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <QuickAction label="Register New Student" to="/students/register" icon={UserPlus} desc="Add a new student and auto-generate admission number" />
            <QuickAction label="Mark Attendance" to="/attendance/mark" icon={ClipboardCheck} desc="Record today's attendance for a class" />
            <QuickAction label="Upload Results" to="/results/upload" icon={TrendingUp} desc="Enter CA and exam scores for a subject" />
            <QuickAction label="Generate ID Cards" to="/idcards" icon={CreditCard} desc="Print student ID cards with QR code" />
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Students & Settings */}
      <div className="grid-2-col" style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: 24, alignItems: 'start' }}>

        {/* Recent Students Table */}
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <h3>Recently Registered Students</h3>
            <Link to="/students" className="btn btn-secondary btn-sm">View All</Link>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Admission No.</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Loading students...</td>
                  </tr>
                ) : stats?.recentStudents?.length > 0 ? (
                  stats.recentStudents.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td><code style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>{s.admissionNo}</code></td>
                      <td>{s.class}</td>
                      <td>
                        <span className={`badge badge-${s.status === 'ACTIVE' ? 'success' : 'warning'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/students/${s.id}`} className="btn btn-secondary btn-sm">View</Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No recent students found in the database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* School Branding */}
        <SchoolSettingsCard />
      </div>
    </div>
  );
}
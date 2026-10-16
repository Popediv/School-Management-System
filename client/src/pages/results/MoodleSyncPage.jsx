/**
 * MoodleSyncPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full Moodle → SMS integration dashboard (SUPER_ADMIN only).
 *
 * Tabs:
 *   1. Configuration  — set Moodle URL, token, idField, course→subject mappings
 *   2. Run Sync       — choose session/term, trigger sync, stream live log
 *   3. Sync History   — view last 50 sync runs
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  Link2, Settings, Play, History, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Plus, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Wifi, DownloadCloud
} from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../context/SettingsContext';

// ── API helpers ───────────────────────────────────────────────────────────────

const moodleApi = {
  getConfig:  ()           => api.get('/moodle-sync/config').then(r => r.data),
  saveConfig: (body)       => api.post('/moodle-sync/config', body).then(r => r.data),
  testConn:   ()           => api.post('/moodle-sync/test').then(r => r.data),
  getCourses: ()           => api.get('/moodle-sync/courses').then(r => r.data),
  runSync:    (body)       => api.post('/moodle-sync/run', body, { timeout: 180000 }).then(r => r.data),
  getLogs:    ()           => api.get('/moodle-sync/logs').then(r => r.data),
};

// ── Tiny components ───────────────────────────────────────────────────────────

const Spinner = ({ size = 18 }) => (
  <Loader2 size={size} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
);

const StatusBadge = ({ status }) => {
  const map = {
    success: { color: 'var(--success)', icon: <CheckCircle2 size={14} />, label: 'Success' },
    error:   { color: 'var(--danger)',  icon: <XCircle size={14} />,       label: 'Failed'  },
  };
  const s = map[status] || { color: 'var(--text-muted)', icon: <AlertTriangle size={14} />, label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: s.color, fontWeight: 600, fontSize: '0.82rem' }}>
      {s.icon} {s.label}
    </span>
  );
};

const LogLine = ({ entry }) => {
  const colors = { error: 'var(--danger)', warn: 'var(--warning)', success: 'var(--success)', info: 'var(--text-muted)' };
  return (
    <div style={{ fontSize: '0.78rem', color: colors[entry.type] || 'var(--text)', padding: '2px 0', fontFamily: 'monospace' }}>
      <span style={{ opacity: 0.5, marginRight: 8 }}>{entry.time ? new Date(entry.time).toLocaleTimeString() : ''}</span>
      {entry.message}
    </div>
  );
};

// ── Tab 1: Configuration ──────────────────────────────────────────────────────

function ConfigTab({ subjects }) {
  const qc = useQueryClient();

  const { data: savedCfg, isLoading } = useQuery({
    queryKey: ['moodle-config'],
    queryFn:  moodleApi.getConfig,
    retry: false,
  });

  const [moodleUrl,   setMoodleUrl]   = useState('');
  const [moodleToken, setMoodleToken] = useState('');
  const [idField,     setIdField]     = useState('username');
  const [courseMap,   setCourseMap]   = useState([]);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState(null);

  // Seed form when config loads
  useEffect(() => {
    if (savedCfg) {
      setMoodleUrl(savedCfg.moodleUrl   || '');
      setMoodleToken(savedCfg.moodleToken || '');
      setIdField(savedCfg.idField       || 'username');
      setCourseMap(savedCfg.courseMap   || []);
    }
  }, [savedCfg]);

  const saveMut = useMutation({
    mutationFn: () => moodleApi.saveConfig({ moodleUrl, moodleToken, idField, courseMap }),
    onSuccess: (data) => {
      toast.success('Moodle config saved!');
      qc.invalidateQueries({ queryKey: ['moodle-config'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first so the server has the latest token
      await moodleApi.saveConfig({ moodleUrl, moodleToken, idField, courseMap });
      const res = await moodleApi.testConn();
      setTestResult({ ok: true, ...res });
    } catch (err) {
      setTestResult({ ok: false, message: err.response?.data?.message || err.message });
    } finally {
      setTesting(false);
    }
  };

  const [fetchingCourses, setFetchingCourses] = useState(false);

  const handleFetchCourses = async () => {
    setFetchingCourses(true);
    try {
      await moodleApi.saveConfig({ moodleUrl, moodleToken, idField, courseMap });
      const res = await moodleApi.getCourses();
      const fetched = res.courses || [];
      if (!fetched.length) {
        toast.info('No courses found in Moodle');
        return;
      }
      setCourseMap(prev => {
        const existingMap = new Map(prev.map(c => [Number(c.courseId), c]));
        const merged = fetched.map(fc => {
          const existing = existingMap.get(Number(fc.id));
          if (existing) {
            return { ...existing, courseName: fc.fullname };
          }
          // Attempt auto-match by name or code
          const match = subjects.find(s =>
            fc.fullname.toLowerCase().includes(s.name.toLowerCase()) ||
            (s.code && fc.shortname.toLowerCase().includes(s.code.toLowerCase()))
          );
          return {
            courseId: fc.id,
            courseName: fc.fullname,
            subjectCode: match ? match.code : '',
            caGradeItemName: 'CA',
            examGradeItemName: 'EXAM',
          };
        });
        return merged;
      });
      toast.success(`Loaded ${fetched.length} course(s) from Moodle!`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to fetch courses');
    } finally {
      setFetchingCourses(false);
    }
  };

  const addCourse = () => setCourseMap(prev => [...prev, {
    courseId: '', courseName: '', subjectCode: '', caGradeItemName: 'CA', examGradeItemName: 'EXAM'
  }]);

  const removeCourse = (i) => setCourseMap(prev => prev.filter((_, idx) => idx !== i));

  const updateCourse = (i, field, val) =>
    setCourseMap(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={28} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Connection settings */}
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>
          <Settings size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Moodle Connection
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Moodle Site URL <span className="required">*</span></label>
            <input
              className="form-input"
              placeholder="https://moodle.yourschool.com"
              value={moodleUrl}
              onChange={e => setMoodleUrl(e.target.value)}
            />
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              No trailing slash. Must be accessible from your SMS server.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Web Service Token <span className="required">*</span></label>
            <input
              className="form-input"
              type="password"
              placeholder="Paste your Moodle web service token"
              value={moodleToken}
              onChange={e => setMoodleToken(e.target.value)}
              autoComplete="off"
            />
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              Generate from: Moodle Admin → Site Administration → Plugins → Web services → Manage tokens
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Student Identifier Field</label>
            <select className="form-select" value={idField} onChange={e => setIdField(e.target.value)}>
              <option value="username">username  (recommended — set this to admission no.)</option>
              <option value="idnumber">idnumber  (Moodle's "ID number" profile field)</option>
              <option value="email">email</option>
            </select>
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              Which Moodle user field holds the student's admission number.
            </span>
          </div>
        </div>

        {/* Test result banner */}
        {testResult && (
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem',
            background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult.ok ? 'var(--success)' : 'var(--danger)'}`,
            color: testResult.ok ? 'var(--success)' : 'var(--danger)',
          }}>
            {testResult.ok
              ? <> Connected to <strong>{testResult.siteName}</strong> (v{testResult.siteVersion}) — logged in as <strong>{testResult.username}</strong></>
              : <> {testResult.message}</>
            }
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={handleTest}
            disabled={testing || !moodleUrl || !moodleToken}
          >
            {testing ? <><Spinner size={15} /> Testing…</> : <><Wifi size={15} /> Test Connection</>}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? <><Spinner size={15} /> Saving…</> : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Course → Subject Mappings */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            <Link2 size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Course → Subject Mappings
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
              onClick={handleFetchCourses}
              disabled={fetchingCourses || !moodleUrl || !moodleToken}
              title="Pulls all Moodle courses and IDs automatically"
            >
              {fetchingCourses ? <><Spinner size={14} /> Fetching…</> : <><DownloadCloud size={14} /> Auto-Fetch Moodle Courses</>}
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={addCourse}>
              <Plus size={14} /> Add Single
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: 14 }}>
          Map each Moodle course to an SMS subject. Multiple Moodle courses (e.g. Maths JSS1, Maths JSS2) can map to the <strong>same</strong> SMS Subject (Mathematics) because each candidate's class is already tracked by their admission number!
        </p>

        {courseMap.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            No mappings yet. Click <strong>Auto-Fetch Moodle Courses</strong> to load them all at once, or <strong>+ Add Single</strong>.
          </div>
        )}

        {courseMap.map((c, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr auto',
            gap: 10, alignItems: 'end', marginBottom: 10,
            padding: 12, background: 'var(--bg-hover)', borderRadius: 8,
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Moodle Course ID</span>
                {c.courseName && (
                  <span style={{ color: 'var(--primary)', fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.courseName}>
                    {c.courseName}
                  </span>
                )}
              </label>
              <input
                className="form-input"
                type="number"
                placeholder="e.g. 4"
                value={c.courseId}
                onChange={e => updateCourse(i, 'courseId', parseInt(e.target.value) || '')}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Subject Code (SMS)</label>
              <select
                className="form-select"
                value={c.subjectCode}
                onChange={e => updateCourse(i, 'subjectCode', e.target.value)}
              >
                <option value="">Select subject…</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.code}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>CA Grade Item</label>
              <input
                className="form-input"
                placeholder="e.g. CA"
                value={c.caGradeItemName}
                onChange={e => updateCourse(i, 'caGradeItemName', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Exam Grade Item</label>
              <input
                className="form-input"
                placeholder="e.g. EXAM"
                value={c.examGradeItemName}
                onChange={e => updateCourse(i, 'examGradeItemName', e.target.value)}
              />
            </div>
            <button
              className="btn"
              style={{ color: 'var(--danger)', padding: '6px 10px', minWidth: 'auto' }}
              onClick={() => removeCourse(i)}
              title="Remove mapping"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {courseMap.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? <><Spinner size={15} /> Saving…</> : 'Save All Mappings'}
            </button>
          </div>
        )}
      </div>

      {/* Setup guide */}
      <div className="card" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <h4 style={{ marginBottom: 10, fontSize: '0.9rem' }}>🔧 How to enable Moodle Web Services</h4>
        <ol style={{ paddingLeft: 18, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.9, margin: 0 }}>
          <li>Moodle Admin → <strong>Site Administration → Advanced Features</strong> → Enable Web Services ✅</li>
          <li>Moodle Admin → <strong>Plugins → Web services → Manage protocols</strong> → Enable <strong>REST</strong> ✅</li>
          <li>Moodle Admin → <strong>Plugins → Web services → Add service</strong> → Create a service, add functions:
            <code style={{ display: 'block', margin: '4px 0 4px 12px', fontSize: '0.78rem' }}>
              core_course_get_courses (to auto-fetch all subjects and IDs)<br />
              core_enrol_get_enrolled_users<br />
              gradereport_user_get_grade_items<br />
              core_webservice_get_site_info
            </code>
          </li>
          <li>Moodle Admin → <strong>Plugins → Web services → Manage tokens</strong> → Generate token for an admin → paste it above</li>
        </ol>
      </div>
    </div>
  );
}

// ── Tab 2: Run Sync ───────────────────────────────────────────────────────────

const TERMS = [
  { label: 'First Term',  value: 'FIRST'  },
  { label: 'Second Term', value: 'SECOND' },
  { label: 'Third Term',  value: 'THIRD'  },
];

function RunSyncTab() {
  const { currentSession, currentTerm } = useSettings();
  const [session,   setSession]   = useState(currentSession || '');
  const [term,      setTerm]      = useState(currentTerm    || 'FIRST');
  const [running,   setRunning]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [logLines,  setLogLines]  = useState([]);
  const logRef = useRef(null);

  useEffect(() => {
    if (currentSession) setSession(currentSession);
    if (currentTerm)    setTerm(currentTerm);
  }, [currentSession, currentTerm]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const handleRun = async () => {
    if (!session.trim()) return toast.warning('Please enter the academic session');
    if (!term)           return toast.warning('Please select a term');

    setRunning(true);
    setResult(null);
    setLogLines([{ type: 'info', message: '🚀 Starting Moodle sync…' }]);

    try {
      const res = await moodleApi.runSync({ session: session.trim(), term });
      setResult(res);
      setLogLines(res.log || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Sync failed';
      setResult({ status: 'error', message: msg });
      setLogLines([{ type: 'error', message: msg }]);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Controls */}
      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: '1rem', fontWeight: 700 }}>
          <Play size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Run Moodle Grade Sync
        </h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
          Pulls all grade data from Moodle for the selected session/term and writes
          results directly into your SMS database, matched by admission number.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
            <label className="form-label">Academic Session <span className="required">*</span></label>
            <input
              className="form-input"
              placeholder="e.g. 2025/2026"
              value={session}
              onChange={e => setSession(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
            <label className="form-label">Term <span className="required">*</span></label>
            <select className="form-select" value={term} onChange={e => setTerm(e.target.value)}>
              {TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={running}
            style={{ minWidth: 140 }}
          >
            {running
              ? <><Spinner size={16} /> Syncing…</>
              : <><RefreshCw size={16} /> Start Sync</>
            }
          </button>
        </div>
      </div>

      {/* Result summary */}
      {result && (
        <div className="card" style={{
          borderLeft: `4px solid ${result.status === 'success' ? 'var(--success)' : 'var(--danger)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <StatusBadge status={result.status} />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{result.message}</span>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>✅ Saved: <strong style={{ color: 'var(--success)' }}>{result.saved ?? 0}</strong></span>
            <span>⚠ Skipped: <strong style={{ color: 'var(--warning)' }}>{result.skipped ?? 0}</strong></span>
            <span>❌ Errors: <strong style={{ color: result.errors?.length ? 'var(--danger)' : 'inherit' }}>{result.errors?.length ?? 0}</strong></span>
          </div>
          {result.errors?.length > 0 && (
            <ul style={{ marginTop: 10, paddingLeft: 16, fontSize: '0.78rem', color: 'var(--danger)' }}>
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Live log */}
      {logLines.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem' }}>
            Sync Log
          </div>
          <div
            ref={logRef}
            style={{
              padding: '12px 16px',
              maxHeight: 320,
              overflowY: 'auto',
              background: 'var(--bg-dark, #0f0f12)',
              borderRadius: '0 0 12px 12px',
            }}
          >
            {logLines.map((l, i) => <LogLine key={i} entry={l} />)}
            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                <Spinner size={13} /> Running…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 3: Sync History ───────────────────────────────────────────────────────

function HistoryTab() {
  const [expanded, setExpanded] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['moodle-sync-logs'],
    queryFn:  moodleApi.getLogs,
    refetchOnWindowFocus: false,
  });

  const logs = data?.logs || [];

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
          <History size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Sync History
        </h3>
        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center' }}><Spinner size={24} /></div>
      )}

      {!isLoading && logs.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          No sync runs yet. Go to <strong>Run Sync</strong> to start your first sync.
        </div>
      )}

      {logs.map((run, i) => (
        <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', cursor: 'pointer' }}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            <StatusBadge status={run.status} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {run.session} · {run.term} Term
              </span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(run.startedAt).toLocaleString()} · by {run.triggeredBy}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>✅ {run.saved ?? 0} saved</span>
              <span>⚠ {run.skipped ?? 0} skipped</span>
              <span>❌ {run.errors?.length ?? 0} errors</span>
            </div>
            {expanded === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {expanded === i && run.log?.length > 0 && (
            <div style={{ background: 'var(--bg-dark, #0f0f12)', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              {run.log.map((l, j) => <LogLine key={j} entry={l} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'config',  label: 'Configuration', icon: Settings },
  { id: 'run',     label: 'Run Sync',       icon: Play     },
  { id: 'history', label: 'History',        icon: History  },
];

export default function MoodleSyncPage() {
  const [activeTab, setActiveTab] = useState('config');

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn:  () => api.get('/subjects').then(r => r.data.subjects || r.data || []),
    placeholderData: [],
  });
  const subjects = subjectsData || [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">
            <Link2 size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Moodle Integration
          </h1>
          <p className="page-header-subtitle">
            Automatically sync student grades from Moodle into the SMS using admission numbers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', fontSize: '0.88rem', fontWeight: active ? 700 : 500,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'config'  && <ConfigTab  subjects={subjects} />}
      {activeTab === 'run'     && <RunSyncTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { classService, subjectService, resultService } from '../../services';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { Upload, Save, Link2, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

export default function UploadResultsPage() {
  const qc = useQueryClient();
  const { currentSession, currentTerm } = useSettings();
  const { user } = useAuth();
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState(currentTerm === 'SECOND' ? 'Second Term' : currentTerm === 'THIRD' ? 'Third Term' : 'First Term');
  const [session, setSession] = useState(currentSession || '2026/2027');
  const [scores, setScores] = useState({});  // { studentId: { ca, exam } }
  const [students, setStudents] = useState([]);
  const [loadingStu, setLoadingStu] = useState(false);
  const [existingResults, setExistingResults] = useState({});
  const [hasExistingScores, setHasExistingScores] = useState(false);

  useEffect(() => {
    if (currentSession) setSession(currentSession);
    if (currentTerm) setTerm(currentTerm === 'SECOND' ? 'Second Term' : currentTerm === 'THIRD' ? 'Third Term' : 'First Term');
  }, [currentSession, currentTerm]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [
      { id: 'c1', name: 'JSS1A' }, { id: 'c2', name: 'SS1A' }, { id: 'c3', name: 'SS2A' },
    ],
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectService.getAll().then(r => r.data.subjects || r.data || []),
    placeholderData: [
      { id: 's1', name: 'Mathematics' }, { id: 's2', name: 'English Language' },
      { id: 's3', name: 'Physics' }, { id: 's4', name: 'Chemistry' },
    ],
  });

  // Fetch students & prefill existing scores from DB whenever filters change
  const fetchClassData = async () => {
    if (!classId) {
      setStudents([]);
      setScores({});
      setExistingResults({});
      setHasExistingScores(false);
      return;
    }
    setLoadingStu(true);
    try {
      const res = await resultService.getClassScores({
        classId,
        subjectId: subjectId || undefined,
        session: session ? session.trim() : undefined,
        term,
      });
      const list = res.data.students || [];
      const resMap = res.data.resultsMap || {};
      setStudents(list);
      setExistingResults(resMap);

      let foundScores = false;
      const init = {};
      list.forEach(s => {
        const ex = resMap[s.id];
        const hasValue = ex && (ex.caScore !== undefined || ex.examScore !== undefined);
        if (hasValue && (ex.caScore > 0 || ex.examScore > 0)) {
          foundScores = true;
        }
        init[s.id] = {
          ca: (ex?.caScore !== undefined && ex?.caScore !== null) ? ex.caScore : '',
          exam: (ex?.examScore !== undefined && ex?.examScore !== null) ? ex.examScore : '',
        };
      });
      setScores(init);
      setHasExistingScores(foundScores);
    } catch (err) {
      // Fallback to basic students list
      try {
        const res = await api.get(`/students?classId=${classId}`);
        const list = res.data.students || [];
        setStudents(list);
        const init = {};
        list.forEach(s => { init[s.id] = { ca: '', exam: '' }; });
        setScores(init);
      } catch (e) {
        toast.error('Failed to load class students');
      }
    } finally {
      setLoadingStu(false);
    }
  };

  useEffect(() => {
    fetchClassData();
  }, [classId, subjectId, session, term]);

  const setScore = (studentId, field, value) => {
    setScores(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (data) => resultService.upload(data),
    onSuccess: () => {
      toast.success('Results saved successfully!');
      fetchClassData();
      qc.invalidateQueries({ queryKey: ['results'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!classId) return toast.warning('Please select a class');
    if (!subjectId) return toast.warning('Please select a subject');
    if (students.length === 0) return toast.warning('No students loaded');

    if (!session.trim()) return toast.warning('Please enter the academic session (e.g. 2025/2026)');

    const records = students.map(s => {
      const ca = parseFloat(scores[s.id]?.ca || 0);
      const exam = parseFloat(scores[s.id]?.exam || 0);
      return { studentId: s.id, subjectId, classId, term, session: session.trim(), ca, exam, total: ca + exam };
    });

    const invalid = records.filter(r => r.ca > 40 || r.exam > 60 || r.ca < 0 || r.exam < 0);
    if (invalid.length > 0) return toast.warning('CA must be ≤40 and Exam must be ≤60');

    upload({ records });
  };

  const handleTeacherExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!classId || !subjectId || !session) return toast.warning('Class, Subject, and Session required before uploading EXCEL');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('classId', classId);
    fd.append('subjectId', subjectId);
    fd.append('term', term);
    fd.append('session', session);

    const loader = toast.loading('Uploading and processing teacher excel...');
    try {
      const res = await resultService.uploadTeacherExcel(fd);
      toast.update(loader, { render: res.data.message, type: 'success', isLoading: false, autoClose: 3000 });
      qc.invalidateQueries({ queryKey: ['results'] });
    } catch (err) {
      toast.update(loader, { render: err.response?.data?.message || 'Upload failed', type: 'error', isLoading: false, autoClose: 4000 });
    }
  };

  const handleSuperadminExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!session) return toast.warning('Session required before uploading SUPERADMIN EXCEL');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('term', term);
    fd.append('session', session);

    const loader = toast.loading('Uploading and processing superadmin excel...');
    try {
      const res = await resultService.uploadSuperadminExcel(fd);
      toast.update(loader, { render: res.data.message, type: 'success', isLoading: false, autoClose: 3000 });
      qc.invalidateQueries({ queryKey: ['results'] });
    } catch (err) {
      toast.update(loader, { render: err.response?.data?.message || 'Upload failed', type: 'error', isLoading: false, autoClose: 4000 });
    }
  };

  const total = (id) => {
    const ca = parseFloat(scores[id]?.ca || 0);
    const exam = parseFloat(scores[id]?.exam || 0);
    const t = ca + exam;
    return { total: t, grade: t >= 70 ? 'A' : t >= 60 ? 'B' : t >= 50 ? 'C' : t >= 40 ? 'D' : 'F' };
  };

  const GRADE_COLOR = { A: 'badge-success', B: 'badge-info', C: 'badge-warning', D: 'badge-danger', F: 'badge-danger' };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Upload Results</h1>
          <p className="page-header-subtitle">Enter CA (max 40) and Exam (max 60) scores per student</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {classId && subjectId && session && (
            <label className="btn btn-secondary">
              <Upload size={16} /> Teacher Sheet
              <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleTeacherExcelUpload} />
            </label>
          )}
          {user?.role === 'SUPER_ADMIN' && (
            <Link to="/results/moodle-sync" className="btn btn-secondary">
              <Link2 size={16} /> Sync from Moodle
            </Link>
          )}
          {user?.role === 'SUPER_ADMIN' && session && (
            <label className="btn btn-warning">
              <Upload size={16} /> Complex Sheet (SuperAdmin)
              <input type="file" accept=".xlsx, .xls" style={{ display: 'none' }} onChange={handleSuperadminExcelUpload} />
            </label>
          )}
          {students.length > 0 && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                : <><Save size={16} /> Save Results</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="card mb-4">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Class <span className="required">*</span></label>
            <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="form-label">Subject <span className="required">*</span></label>
            <select className="form-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label">Term</label>
            <select className="form-select" value={term} onChange={e => setTerm(e.target.value)}>
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth: 130 }}>
            <label className="form-label">Session <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 2026/2027"
              value={session}
              onChange={e => setSession(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Database sync / existing scores indicator */}
      {hasExistingScores && (
        <div style={{
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Existing scores loaded from database
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Scores from previous entry or Moodle sync are loaded. Edit any marks below and click <strong>Save Results</strong> to update.
              </div>
            </div>
          </div>
          <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
            {Object.keys(existingResults).length} Records in DB
          </span>
        </div>
      )}

      {/* Empty / Loading states */}
      {!classId && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Upload size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 14px', display: 'block' }} />
          <p className="text-muted">Select a class and subject above to load students and enter scores.</p>
        </div>
      )}
      {classId && loadingStu && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto' }} />
          <p className="text-muted mt-4">Loading scores from database…</p>
        </div>
      )}

      {/* Scores Table */}
      {!loadingStu && students.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>#</th>
                <th>Student</th>
                <th>Admission No.</th>
                <th style={{ color: 'var(--primary-light)' }}>CA (max 40)</th>
                <th style={{ color: 'var(--secondary)' }}>Exam (max 60)</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Position</th>
              </tr></thead>
              <tbody>
                {students.map((s, i) => {
                  const { total: tot, grade } = total(s.id);
                  const dbResult = existingResults[s.id];
                  return (
                    <tr key={s.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td><strong>{s.lastName} {s.firstName}</strong></td>
                      <td><code style={{ fontSize: '0.78rem', color: 'var(--primary-light)' }}>{s.admissionNo}</code></td>
                      <td>
                        <input
                          type="number" min="0" max="40"
                          className="form-input"
                          style={{ width: 80, padding: '6px 10px' }}
                          placeholder="0"
                          value={scores[s.id]?.ca || ''}
                          onChange={e => setScore(s.id, 'ca', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" max="60"
                          className="form-input"
                          style={{ width: 80, padding: '6px 10px' }}
                          placeholder="0"
                          value={scores[s.id]?.exam || ''}
                          onChange={e => setScore(s.id, 'exam', e.target.value)}
                        />
                      </td>
                      <td>
                        <strong style={{ fontSize: '1rem', color: tot >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                          {tot || '—'}
                        </strong>
                      </td>
                      <td>
                        {(scores[s.id]?.ca !== '' || scores[s.id]?.exam !== '') && (
                          <span className={`badge ${GRADE_COLOR[grade]}`}>{grade}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: 600 }}>
                          {dbResult?.position || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                : <><Save size={16} /> Save {students.length} Results</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

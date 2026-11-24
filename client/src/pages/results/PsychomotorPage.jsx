import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Award, Save, RefreshCw, CheckCircle2, AlertCircle, Sparkles, User } from 'lucide-react';
import api from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { SESSIONS } from '../../utils/constants';

const TERMS = [
  { value: 'FIRST',  label: 'First Term'  },
  { value: 'SECOND', label: 'Second Term' },
  { value: 'THIRD',  label: 'Third Term'  },
];

const PSYCHOMOTOR_TRAITS = [
  { key: 'Attentiveness', label: 'Attentiveness' },
  { key: 'Handwriting',   label: 'Handwriting'   },
  { key: 'Honesty',       label: 'Honesty'       },
  { key: 'Neatness',      label: 'Neatness'      },
  { key: 'Politeness',    label: 'Politeness'    },
  { key: 'Punctuality',   label: 'Punctuality'   },
  { key: 'Speech Fluency',label: 'Speech'        },
  { key: 'Sports & Games',label: 'Sports'        },
];

export default function PsychomotorPage() {
  const qc = useQueryClient();
  const { currentSession, currentTerm } = useSettings();

  const [classId, setClassId] = useState('');
  const [session, setSession] = useState(currentSession || '2026/2027');
  const [term, setTerm] = useState(currentTerm || 'FIRST');
  const [ratings, setRatings] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (currentSession) setSession(currentSession);
    if (currentTerm) setTerm(currentTerm);
  }, [currentSession, currentTerm]);

  // Load Classes
  const { data: classesData = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data.classes || r.data || []),
  });
  const classes = classesData;

  // Auto-select first class if none selected
  useEffect(() => {
    if (!classId && classes.length > 0) {
      setClassId(classes[0].id);
    }
  }, [classes, classId]);

  // Load Students and existing ratings for this class + session + term
  const { data: classData, isLoading, refetch } = useQuery({
    queryKey: ['psychomotor', classId, session, term],
    queryFn: () =>
      api.get('/results/psychomotor', { params: { classId, session, term } }).then(r => r.data),
    enabled: !!classId && !!session && !!term,
  });

  const students = classData?.students || [];
  const savedRatingsMap = classData?.ratingsMap || {};

  // Seed state when classData changes
  useEffect(() => {
    if (savedRatingsMap) {
      setRatings(savedRatingsMap);
      setIsDirty(false);
    }
  }, [classData]);

  // Update a student's trait rating
  const handleRate = (studentId, traitKey, score) => {
    setRatings(prev => {
      const studentTraits = { ...(prev[studentId] || {}) };
      studentTraits[traitKey] = score;
      return { ...prev, [studentId]: studentTraits };
    });
    setIsDirty(true);
  };

  // Quick-fill: Give all unrated students a commendable 4 or 5
  const handleQuickFill = () => {
    setRatings(prev => {
      const next = { ...prev };
      students.forEach((s, sIdx) => {
        const studentTraits = { ...(next[s.id] || {}) };
        PSYCHOMOTOR_TRAITS.forEach((t, tIdx) => {
          if (!studentTraits[t.key]) {
            studentTraits[t.key] = ((sIdx + tIdx) % 2 === 0) ? 5 : 4;
          }
        });
        next[s.id] = studentTraits;
      });
      return next;
    });
    setIsDirty(true);
    toast.info('Filled default scores (4 & 5). You can adjust individual ones before saving.');
  };

  // Mutation to save psychomotor ratings
  const saveMutation = useMutation({
    mutationFn: () => {
      const records = students.map(s => ({
        studentId: s.id,
        classId,
        session,
        term,
        traits: ratings[s.id] || {},
      }));
      return api.post('/results/psychomotor', { records, classId, session, term });
    },
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Psychomotor ratings saved successfully!');
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ['psychomotor', classId, session, term] });
      qc.invalidateQueries({ queryKey: ['report-card'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save psychomotor ratings');
    },
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-header-title">
            <Award size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--primary)' }} />
            Psychomotor & Behavioural Assessment
          </h1>
          <p className="page-header-subtitle">
            Record each student's behavioural traits (Scale 1–5). Exactly what you save here will print on their official report cards.
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
              <label className="form-label">Select Class</label>
              <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
              <label className="form-label">Session</label>
              <select className="form-select" value={session} onChange={e => setSession(e.target.value)}>
                {(SESSIONS || ['2025/2026', '2026/2027', '2027/2028']).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
              <label className="form-label">Term</label>
              <select className="form-select" value={term} onChange={e => setTerm(e.target.value)}>
                {TERMS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => refetch()}
              title="Refresh student list"
              style={{ height: 40 }}
            >
              <RefreshCw size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleQuickFill}
              disabled={students.length === 0}
              style={{ fontSize: '0.85rem' }}
              title="Fill empty scores with commendable 4 & 5"
            >
              <Sparkles size={15} style={{ color: 'var(--warning)' }} />
              Quick Fill (4s & 5s)
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || students.length === 0}
              style={{ minWidth: 140, fontWeight: 600 }}
            >
              <Save size={15} />
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Rating Guide Banner */}
        <div style={{
          marginTop: 14,
          padding: '8px 14px',
          background: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div>
            <strong>Rating Scale:</strong> &nbsp;
            <span style={{ color: '#166534', fontWeight: 600 }}>5 = Excellent</span> &nbsp;·&nbsp;
            <span style={{ color: '#1d4ed8', fontWeight: 600 }}>4 = Very Good</span> &nbsp;·&nbsp;
            <span style={{ color: '#92400e', fontWeight: 600 }}>3 = Good</span> &nbsp;·&nbsp;
            <span style={{ color: '#c2410c', fontWeight: 600 }}>2 = Fair</span> &nbsp;·&nbsp;
            <span style={{ color: '#b91c1c', fontWeight: 600 }}>1 = Poor</span>
          </div>
          {isDirty && (
            <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={14} /> You have unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Main Assessment Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            No students found in this class.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ width: 40, textAlign: 'center', padding: '10px 8px' }}>#</th>
                  <th style={{ minWidth: 200, padding: '10px 12px' }}>Student</th>
                  {PSYCHOMOTOR_TRAITS.map(t => (
                    <th key={t.key} style={{ minWidth: 105, textAlign: 'center', padding: '10px 4px' }} title={t.label}>
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const sTraits = ratings[student.id] || {};
                  const photoSrc = student.photo
                    ? (student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`)
                    : null;

                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'var(--bg-hover)',
                            border: '1px solid var(--border)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {photoSrc ? (
                              <img src={photoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {student.lastName} {student.firstName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {student.admissionNo}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 8 Psychomotor Trait Rating Cells */}
                      {PSYCHOMOTOR_TRAITS.map(t => {
                        const val = sTraits[t.key] || 0;
                        return (
                          <td key={t.key} style={{ textAlign: 'center', padding: '6px 4px' }}>
                            <div style={{ display: 'inline-flex', gap: 2 }}>
                              {[1, 2, 3, 4, 5].map(score => {
                                const isSelected = val === score;
                                return (
                                  <button
                                    key={score}
                                    type="button"
                                    onClick={() => handleRate(student.id, t.key, score)}
                                    style={{
                                      width: 22,
                                      height: 24,
                                      border: isSelected ? '1px solid #10264F' : '1px solid var(--border)',
                                      borderRadius: 4,
                                      background: isSelected ? '#10264F' : 'var(--bg-surface, #fff)',
                                      color: isSelected ? '#fff' : 'var(--text-muted)',
                                      fontSize: '0.75rem',
                                      fontWeight: isSelected ? 800 : 500,
                                      cursor: 'pointer',
                                      padding: 0,
                                      transition: 'all 0.1s',
                                    }}
                                    title={`${student.firstName} - ${t.label}: ${score}`}
                                  >
                                    {score}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Save Bar when dirty */}
      {isDirty && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 28,
          zIndex: 80,
          background: 'var(--bg-surface, #1e293b)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <span style={{ fontSize: '0.88rem' }}>You have unsaved psychomotor ratings</span>
          <button
            className="btn btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{ fontWeight: 700 }}
          >
            <Save size={15} />
            {saveMutation.isPending ? 'Saving…' : 'Save Now'}
          </button>
        </div>
      )}
    </div>
  );
}

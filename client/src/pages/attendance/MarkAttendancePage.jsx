import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { attendanceService, classService } from '../../services';
import { ClipboardCheck, CheckCircle, XCircle, Clock, Save } from 'lucide-react';
import api from '../../services/api';

const STATUSES = [
  { key: 'PRESENT', label: 'Present', icon: CheckCircle, btnClass: 'btn-success' },
  { key: 'ABSENT',  label: 'Absent',  icon: XCircle,     btnClass: 'btn-danger'  },
  { key: 'LATE',    label: 'Late',    icon: Clock,        btnClass: 'btn-warning' },
];

const BADGE_COLOR = { PRESENT: 'success', ABSENT: 'danger', LATE: 'warning' };

export default function MarkAttendancePage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [
      { id: 'c1', name: 'JSS1A' }, { id: 'c2', name: 'JSS2B' },
      { id: 'c3', name: 'SS1A' },  { id: 'c4', name: 'SS2A'  },
    ],
  });

  useEffect(() => {
    if (!selectedClass) { setStudents([]); return; }
    setLoadingStudents(true);
    api.get(`/students?classId=${selectedClass}`)
      .then(res => {
        const list = res.data.students || [];
        setStudents(list);
        const init = {};
        list.forEach(s => { init[s.id] = 'PRESENT'; });
        setAttendance(init);
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));
  }, [selectedClass]);

  const toggle = (id, status) => setAttendance(prev => ({ ...prev, [id]: status }));

  const markAll = (status) => {
    const updated = {};
    students.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const counts = students.reduce((acc, s) => {
    const st = attendance[s.id] || 'PRESENT';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const handleSubmit = async () => {
    if (!selectedClass) return toast.warning('Please select a class first');
    if (students.length === 0) return toast.warning('No students loaded');
    setSubmitting(true);
    try {
      const records = students.map(s => ({
        studentId: s.id,
        status: attendance[s.id] || 'PRESENT',
      }));
      await attendanceService.mark({ classId: selectedClass, date, records });
      toast.success(`Attendance saved for ${students.length} students!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Mark Attendance</h1>
          <p className="page-header-subtitle">Record daily student attendance for your class</p>
        </div>
        {students.length > 0 && (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
              : <><Save size={16}/> Save Attendance</>
            }
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ flex:1, minWidth:200 }}>
            <label className="form-label">Class</label>
            <select className="form-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">Choose a class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth:180 }}>
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {students.length > 0 && (
            <div style={{ display:'flex', gap:8, paddingBottom:1 }}>
              <button className="btn btn-success btn-sm" onClick={() => markAll('PRESENT')}>✓ All Present</button>
              <button className="btn btn-danger btn-sm"  onClick={() => markAll('ABSENT')}>✗ All Absent</button>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {students.length > 0 && (
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
          {STATUSES.map(({ key, label }) => (
            <div key={key} className="card card-sm" style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px' }}>
              <span className={`badge badge-${BADGE_COLOR[key]}`} style={{ fontSize:'1rem', padding:'0 6px' }}>{counts[key] || 0}</span>
              <span className="text-sm text-muted">{label}</span>
            </div>
          ))}
          <div className="card card-sm" style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px' }}>
            <span className="badge badge-primary" style={{ fontSize:'1rem', padding:'0 6px' }}>{students.length}</span>
            <span className="text-sm text-muted">Total</span>
          </div>
        </div>
      )}

      {/* Empty states */}
      {!selectedClass && (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <ClipboardCheck size={44} style={{ color:'var(--text-muted)', margin:'0 auto 14px', display:'block' }} />
          <p className="text-muted">Select a class above to load students and start marking attendance.</p>
        </div>
      )}
      {selectedClass && loadingStudents && (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <div className="animate-spin" style={{ width:36, height:36, border:'3px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', margin:'0 auto 14px' }} />
          <p className="text-muted">Loading students…</p>
        </div>
      )}
      {selectedClass && !loadingStudents && students.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <p className="text-muted">No students found in this class.</p>
        </div>
      )}

      {/* Attendance Table */}
      {!loadingStudents && students.length > 0 && (
        <div className="card" style={{ padding:0 }}>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>#</th><th>Student Name</th><th>Admission No.</th><th>Mark Status</th>
              </tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td><strong>{s.lastName || ''} {s.firstName || s.user?.name || '—'}</strong></td>
                    <td><code style={{ fontSize:'0.8rem', color:'var(--primary-light)' }}>{s.admissionNo}</code></td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        {STATUSES.map(({ key, label, icon: Icon, btnClass }) => (
                          <button
                            key={key}
                            onClick={() => toggle(s.id, key)}
                            className={`btn btn-sm ${attendance[s.id] === key ? btnClass : 'btn-secondary'}`}
                            style={{ padding:'4px 12px', fontSize:'0.78rem' }}
                          >
                            <Icon size={12} /> {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

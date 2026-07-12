import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { teacherService, classService, subjectService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { Search, UserPlus, UserCog, Mail, Phone, UserX, BookPlus, X } from 'lucide-react';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';

const DEMO = [
  { id:'t1', user:{ name:'Mr. Emmanuel Okafor', email:'e.okafor@school.edu' }, phone:'+2348012345678', qualification:'B.Sc Mathematics', subjects:[{ name:'Mathematics' }], classes:[{ name:'SS2A' }] },
  { id:'t2', user:{ name:'Mrs. Adaku Nwosu',    email:'a.nwosu@school.edu'  }, phone:'+2348023456789', qualification:'B.Ed English',     subjects:[{ name:'English Language' }], classes:[{ name:'JSS3B' }] },
  { id:'t3', user:{ name:'Mr. Tunde Alabi',     email:'t.alabi@school.edu'  }, phone:'+2348034567890', qualification:'B.Sc Physics',     subjects:[{ name:'Physics' }], classes:[{ name:'SS1A' }] },
  { id:'t4', user:{ name:'Mrs. Ngozi Eze',      email:'n.eze@school.edu'    }, phone:'+2348045678901', qualification:'B.Sc Biology',     subjects:[{ name:'Biology' }], classes:[{ name:'SS2B' }] },
  { id:'t5', user:{ name:'Mr. Emeka Obi',       email:'e.obi@school.edu'    }, phone:'+2348056789012', qualification:'B.Ed Chemistry',   subjects:[{ name:'Chemistry' }], classes:[{ name:'SS3A' }] },
];

export default function TeacherListPage() {
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [assignModal, setAssignModal] = useState({ show: false, teacher: null });
  const [assignForm, setAssignForm] = useState({ classId: '', subjectId: '', session: CURRENT_SESSION });

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => classService.getAll().then(r => r.data.classes || r.data) });
  const { data: subjects = [] } = useQuery({ queryKey: ['subjects'], queryFn: () => subjectService.getAll().then(r => r.data.subjects || r.data) });

  const { data: teachers = DEMO, isLoading } = useQuery({
    queryKey: ['teachers', search],
    queryFn: () => teacherService.getAll({ search }).then(r => r.data.teachers || r.data || []).catch(() => DEMO),
    placeholderData: DEMO,
  });

  const filtered = search
    ? teachers.filter(t => t.user?.name?.toLowerCase().includes(search.toLowerCase()) || t.user?.email?.toLowerCase().includes(search.toLowerCase()))
    : teachers;

  // Filter out deactivated teachers on frontend if needed, or backend can filter. Assuming backend returns all or just active.
  // For now we'll just show whoever is returned.

  const { mutate: deactivate } = useMutation({
    mutationFn: (id) => teacherService.delete(id),
    onSuccess: () => {
      toast.success('Teacher access revoked successfully');
      qc.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to revoke access');
    }
  });

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to revoke access for ${name}? They will no longer be able to log in.`)) {
      deactivate(id);
    }
  };

  const { mutate: assignClass, isPending: assigning } = useMutation({
    mutationFn: (data) => teacherService.assign(data),
    onSuccess: () => {
      toast.success('Teacher assigned successfully!');
      qc.invalidateQueries({ queryKey: ['teachers'] });
      setAssignModal({ show: false, teacher: null });
      setAssignForm({ classId: '', subjectId: '', session: CURRENT_SESSION });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to assign teacher'),
  });

  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!assignForm.classId || !assignForm.subjectId) return toast.warning('Class and Subject are required');
    assignClass({ teacherId: assignModal.teacher.id, ...assignForm });
  };

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Teachers</h1>
          <p className="page-header-subtitle">{teachers.length} registered teaching staff</p>
        </div>
        <Link to="/teachers/register" className="btn btn-primary">
          <UserPlus size={16}/> Register Teacher
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-stat mb-6">
        <div className="stat-card">
          <div className="stat-icon indigo"><UserCog size={22}/></div>
          <div>
            <div className="stat-value">{teachers.length}</div>
            <div className="stat-label">Total Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><UserCog size={22}/></div>
          <div>
            <div className="stat-value">{teachers.filter(t => t.classes?.length > 0).length}</div>
            <div className="stat-label">With Class Assignments</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-4" style={{ padding:'14px 20px' }}>
        <div className="search-bar">
          <Search size={16}/>
          <input className="form-input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Teacher</th><th>Contact</th><th>Qualification</th><th>Subject(s)</th><th>Class(es)</th>
              {isSuperAdmin && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {isLoading
                ? Array.from({length:4}).map((_,i) => (
                    <tr key={i}>{Array.from({length: isSuperAdmin ? 7 : 6}).map((_,j) => (
                      <td key={j}><div className="skeleton" style={{height:14,width:'80%'}}/></td>
                    ))}</tr>
                  ))
                : filtered.map((t, i) => (
                  <tr key={t.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div className="avatar-placeholder avatar-sm" style={{ fontSize:'0.65rem', flexShrink:0 }}>
                          {initials(t.user?.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.875rem' }}>{t.user?.name}</div>
                          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{t.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.phone && (
                        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', color:'var(--text-secondary)' }}>
                          <Phone size={12}/> {t.phone}
                        </div>
                      )}
                    </td>
                    <td className="text-muted">{t.qualification || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {[...new Set((t.assignments || []).map(a => a.subject?.name))].filter(Boolean).map(name => (
                          <span key={name} className="badge badge-primary">{name}</span>
                        ))}
                        {(!t.assignments || t.assignments.length === 0) && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {[...new Set((t.assignments || []).map(a => a.class?.name))].filter(Boolean).map(name => (
                          <span key={name} className="badge badge-info">{name}</span>
                        ))}
                        {(!t.assignments || t.assignments.length === 0) && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button 
                            className="btn btn-primary btn-icon btn-sm" 
                            title="Assign to Class"
                            onClick={() => { setAssignModal({ show: true, teacher: t }); setAssignForm({ classId:'', subjectId:'', session:CURRENT_SESSION }); }}
                          >
                            <BookPlus size={14} />
                          </button>
                          {t.user?.isActive === false ? (
                            <span className="badge badge-danger">Revoked</span>
                          ) : (
                            <button 
                              className="btn btn-danger btn-icon btn-sm" 
                              title="Revoke Access"
                              onClick={() => handleDelete(t.id, t.user?.name)}
                            >
                              <UserX size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              }
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                  No teachers found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Teacher Modal */}
      {assignModal.show && (
        <div className="modal-overlay" onClick={() => setAssignModal({ show: false, teacher: null })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Assign Teacher to Class</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setAssignModal({ show: false, teacher: null })}><X size={16}/></button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <p className="text-sm text-muted">
                  Assigning <strong>{assignModal.teacher?.user?.name}</strong> to teach a subject in a specific class.
                </p>
                <div className="form-group">
                  <label className="form-label">Class <span className="required">*</span></label>
                  <select className="form-select" value={assignForm.classId} onChange={e => setAssignForm(f => ({ ...f, classId: e.target.value }))}>
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject <span className="required">*</span></label>
                  <select className="form-select" value={assignForm.subjectId} onChange={e => setAssignForm(f => ({ ...f, subjectId: e.target.value }))}>
                    <option value="">Select Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Session</label>
                  <select className="form-select" value={assignForm.session} onChange={e => setAssignForm(f => ({ ...f, session: e.target.value }))}>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignModal({ show: false, teacher: null })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={assigning}>
                  {assigning ? 'Assigning...' : 'Assign Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

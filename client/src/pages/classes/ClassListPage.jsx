import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { classService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { Plus, School, X, Users, BookOpen, Trash2 } from 'lucide-react';

const LEVELS  = ['JSS1','JSS2','JSS3','SS1','SS2','SS3'];
const SECTIONS = ['A','B','C','Gold','Silver','Bronze'];

export default function ClassListPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name:'', level:'', section:'' });

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [
      { id:'c1', name:'JSS1', level:'JSS1', section:'A', _count:{ students:38, subjects:9 } },
      { id:'c2', name:'JSS2', level:'JSS2', section:'B', _count:{ students:42, subjects:9 } },
      { id:'c3', name:'SS1',  level:'SS1',  section:'A', _count:{ students:35, subjects:11 } },
      { id:'c4', name:'SS2',  level:'SS2',  section:'B', _count:{ students:33, subjects:11 } },
      { id:'c5', name:'SS3',  level:'SS3',  section:'A', _count:{ students:29, subjects:11 } },
    ],
  });

  const { mutate: create, isPending } = useMutation({
    mutationFn: (data) => classService.create(data),
    onSuccess: () => {
      toast.success('Class created successfully!');
      qc.invalidateQueries({ queryKey: ['classes'] });
      setShowModal(false);
      setForm({ name:'', level:'', section:'' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create class'),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id) => classService.delete(id),
    onSuccess: () => {
      toast.success('Class deleted successfully!');
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete class'),
  });

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      remove(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return toast.warning('Class name is required');
    create(form);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const levelColor = {
    JSS1:'indigo', JSS2:'cyan', JSS3:'amber', SS1:'green', SS2:'green', SS3:'green',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Classes</h1>
          <p className="page-header-subtitle">{classes.length} classes across all levels</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16}/> Add Class
        </button>
      </div>

      {/* Stats */}
      <div className="grid-stat mb-6">
        {['JSS','SS'].map(level => {
          const count = classes.filter(c => c.level?.startsWith(level)).length;
          return (
            <div key={level} className="stat-card">
              <div className={`stat-icon ${level === 'JSS' ? 'indigo' : 'green'}`}>
                <School size={22}/>
              </div>
              <div>
                <div className="stat-value">{count}</div>
                <div className="stat-label">{level} Classes</div>
              </div>
            </div>
          );
        })}
        <div className="stat-card">
          <div className="stat-icon cyan"><Users size={22}/></div>
          <div>
            <div className="stat-value">{classes.reduce((a,c) => a + (c._count?.students || 0), 0)}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><BookOpen size={22}/></div>
          <div>
            <div className="stat-value">{Math.max(...classes.map(c => c._count?.subjects || 0), 0)}</div>
            <div className="stat-label">Max Subjects/Class</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Class Name</th><th>Level</th><th>Section/Arm</th><th>Students</th><th>Subjects</th>
              {isSuperAdmin && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {isLoading
                ? Array.from({length:5}).map((_,i) => (
                    <tr key={i}>{Array.from({length:6}).map((_,j) => (
                      <td key={j}><div className="skeleton" style={{height:16,width:'80%'}}/></td>
                    ))}</tr>
                  ))
                : classes.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td><span className={`badge badge-${levelColor[c.level] || 'muted'}`}>{c.level || '—'}</span></td>
                    <td>{c.section || '—'}</td>
                    <td>
                      <span className="badge badge-info">{c._count?.students ?? c.students?.length ?? 0}</span>
                    </td>
                    <td>
                      <span className="badge badge-primary">{c._count?.subjects ?? c.subjects?.length ?? 0}</span>
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <button 
                          className="btn btn-danger btn-icon btn-sm" 
                          title="Delete Class"
                          onClick={() => handleDelete(c.id, c.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              }
              {!isLoading && classes.length === 0 && (
                <tr><td colSpan={isSuperAdmin ? 7 : 6} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                  No classes found. Create one to get started.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Class Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add New Class</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}><X size={16}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div className="form-group">
                  <label className="form-label">Class Name <span className="required">*</span></label>
                  <input className="form-input" placeholder="e.g. JSS1" value={form.name}
                    onChange={e => set('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Level</label>
                  <select className="form-select" value={form.level} onChange={e => set('level', e.target.value)}>
                    <option value="">Select level</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Section / Arm</label>
                  <input className="form-input" placeholder="e.g. A, Gold" value={form.section}
                    onChange={e => set('section', e.target.value)} list="sections-list" />
                  <datalist id="sections-list">
                    {SECTIONS.map(s => <option key={s} value={s}/>)}
                  </datalist>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending
                    ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
                    : <><Plus size={16}/> Create Class</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

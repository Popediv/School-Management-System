import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { subjectService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { Plus, BookOpen, X, Trash2, Edit2, Search, Filter } from 'lucide-react';

const LEVELS = ['JSS', 'SS', 'ALL'];
const CATEGORIES = ['Core', 'Science', 'Commercial', 'Arts'];

export default function SubjectListPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(user?.role);

  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  
  const [form, setForm] = useState({ name: '', code: '', level: 'ALL', category: 'Core' });
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectService.getAll().then(r => r.data.subjects || []),
  });

  const { mutate: create, isPending: createPending } = useMutation({
    mutationFn: (data) => subjectService.create(data),
    onSuccess: () => {
      toast.success('Subject created successfully!');
      qc.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create subject'),
  });

  const { mutate: update, isPending: updatePending } = useMutation({
    mutationFn: ({ id, data }) => subjectService.update(id, data),
    onSuccess: () => {
      toast.success('Subject updated successfully!');
      qc.invalidateQueries({ queryKey: ['subjects'] });
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update subject'),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id) => subjectService.delete(id),
    onSuccess: () => {
      toast.success('Subject deleted successfully!');
      qc.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete subject'),
  });

  const handleEdit = (sub) => {
    setEditingSubject(sub);
    setForm({
      name: sub.name,
      code: sub.code,
      level: sub.level || 'ALL',
      category: sub.category || 'Core',
    });
    setShowModal(true);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will remove it from all teacher assignments and results.`)) {
      remove(id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setForm({ name: '', code: '', level: 'ALL', category: 'Core' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Subject Name is required');
    if (!form.code.trim()) return toast.warning('Subject Code is required');

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      level: form.level,
      category: form.category,
    };

    if (editingSubject) {
      update({ id: editingSubject.id, data: payload });
    } else {
      create(payload);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Search & Filter processing
  const filteredSubjects = subjects.filter(sub => {
    const matchesSearch = 
      sub.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.code.toLowerCase().includes(search.toLowerCase());
    
    const matchesLevel = filterLevel === 'ALL' || sub.level === filterLevel || sub.level === 'ALL';
    const matchesCategory = filterCategory === 'ALL' || sub.category === filterCategory;

    return matchesSearch && matchesLevel && matchesCategory;
  });

  const levelColor = {
    JSS: 'indigo',
    SS: 'cyan',
    ALL: 'success',
  };

  const catColor = {
    Core: 'primary',
    Science: 'success',
    Commercial: 'warning',
    Arts: 'danger',
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Subjects</h1>
          <p className="page-header-subtitle">
            {filteredSubjects.length} subjects registered in the system
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add Subject
          </button>
        )}
      </div>

      {/* Stats and filters */}
      <div className="card mb-6">
        <div className="grid-subject-filters">
          {/* Search bar */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} /> Search Subjects
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Level Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Level Filter</label>
            <select
              className="form-select"
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
            >
              <option value="ALL">All Levels</option>
              {LEVELS.map(l => (
                <option key={l} value={l}>{l === 'ALL' ? 'Junior & Senior' : l}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Category Filter</label>
            <select
              className="form-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subjects list */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Subject Name</th>
                <th>Code</th>
                <th>Academic Level</th>
                <th>Category</th>
                {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: isAdmin ? 6 : 5 }).map((_, j) => (
                      <td key={j}>
                        <div className="skeleton" style={{ height: 16, width: '80%' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredSubjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
                    style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}
                  >
                    No subjects found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSubjects.map((sub, idx) => (
                  <tr key={sub.id}>
                    <td className="text-muted">{idx + 1}</td>
                    <td>
                      <strong>{sub.name}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          background: 'var(--bg-elevated)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '0.85em',
                        }}
                      >
                        {sub.code}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${levelColor[sub.level || 'ALL']}`}>
                        {sub.level === 'ALL' ? 'Junior & Senior' : sub.level || 'Junior & Senior'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${catColor[sub.category || 'Core']}`}>
                        {sub.category || 'Core'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Edit Subject"
                            onClick={() => handleEdit(sub)}
                          >
                            <Edit2 size={13} />
                          </button>
                          {isSuperAdmin && (
                            <button
                              className="btn btn-danger btn-icon btn-sm"
                              title="Delete Subject"
                              onClick={() => handleDelete(sub.id, sub.name)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingSubject ? 'Edit Subject Details' : 'Add New Subject'}
              </h3>
              <button className="btn btn-secondary btn-icon" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Subject Name <span className="required">*</span></label>
                  <input
                    className="form-input"
                    placeholder="e.g. Mathematics, Literature in English"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Code <span className="required">*</span></label>
                  <input
                    className="form-input"
                    placeholder="e.g. MTH, LIT"
                    value={form.code}
                    onChange={e => set('code', e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Must be unique across all subjects.
                  </span>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Academic Level</label>
                    <select
                      className="form-select"
                      value={form.level}
                      onChange={e => set('level', e.target.value)}
                    >
                      {LEVELS.map(l => (
                        <option key={l} value={l}>{l === 'ALL' ? 'Junior & Senior' : l}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={form.category}
                      onChange={e => set('category', e.target.value)}
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createPending || updatePending}
                >
                  {createPending || updatePending ? (
                    <span
                      className="animate-spin"
                      style={{
                        width: 16,
                        height: 16,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        display: 'inline-block',
                      }}
                    />
                  ) : editingSubject ? (
                    'Save Changes'
                  ) : (
                    'Create Subject'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

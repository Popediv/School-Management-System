import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { subjectService, classService, schemeService } from '../../services';
import { toast } from 'react-toastify';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import { 
  ArrowLeft, Plus, Edit2, Trash2, Save, FileText, 
  Upload, X, RefreshCw, Calendar 
} from 'lucide-react';

export default function ManageSchemePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get defaults passed from the view page state (if any)
  const defaults = location.state || {
    selectedSubject: '',
    selectedClass: '',
    selectedTerm: 'FIRST',
    selectedSession: CURRENT_SESSION
  };

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(defaults.selectedSubject);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(defaults.selectedClass);
  const [selectedTerm, setSelectedTerm] = useState(defaults.selectedTerm);
  const [selectedSession, setSelectedSession] = useState(defaults.selectedSession);
  
  const [schemes, setSchemes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [file, setFile] = useState(null);
  const [existingFileName, setExistingFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  // Load subjects and classes
  useEffect(() => {
    Promise.all([
      subjectService.getAll(),
      classService.getAll()
    ])
      .then(([subRes, classRes]) => {
        setSubjects(subRes.data.subjects || []);
        if (subRes.data.subjects?.length > 0 && !selectedSubject) {
          setSelectedSubject(subRes.data.subjects[0].id);
        }
        setClasses(classRes.data.classes || []);
        if (classRes.data.classes?.length > 0 && !selectedClass) {
          setSelectedClass(classRes.data.classes[0].id);
        }
      })
      .catch(err => {
        toast.error('Failed to load subjects and classes');
        console.error(err);
      });
  }, []);

  // Fetch schemes of work list
  const fetchSchemes = () => {
    if (!selectedSubject || !selectedClass) return;
    setLoadingList(true);
    schemeService.getAll({
      subjectId: selectedSubject,
      classId: selectedClass,
      term: selectedTerm,
      session: selectedSession
    })
      .then(res => {
        setSchemes(res.data.schemes || []);
      })
      .catch(err => {
        console.error('Error fetching list:', err);
      })
      .finally(() => {
        setLoadingList(false);
      });
  };

  useEffect(() => {
    fetchSchemes();
  }, [selectedSubject, selectedClass, selectedTerm, selectedSession]);

  // Set form for editing
  const startEdit = (scheme) => {
    setEditingId(scheme.id);
    setValue('week', scheme.week);
    setValue('topic', scheme.topic);
    setValue('objectives', scheme.objectives || '');
    setValue('notesText', scheme.notesText || '');
    setExistingFileName(scheme.notesFile || '');
    setFile(null);
  };

  // Reset form
  const cancelEdit = () => {
    setEditingId(null);
    setExistingFileName('');
    setFile(null);
    reset({
      week: '',
      topic: '',
      objectives: '',
      notesText: ''
    });
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this week from the scheme of work?')) return;
    
    try {
      await schemeService.delete(id);
      toast.success('Scheme of work entry deleted successfully');
      fetchSchemes();
      if (editingId === id) cancelEdit();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete entry');
    }
  };

  // Handle Form Submit (Create/Update)
  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('subjectId', selectedSubject);
      fd.append('classId', selectedClass);
      fd.append('term', selectedTerm);
      fd.append('session', selectedSession);
      fd.append('week', data.week);
      fd.append('topic', data.topic);
      fd.append('objectives', data.objectives || '');
      fd.append('notesText', data.notesText || '');
      if (file) {
        fd.append('notesFile', file);
      }

      if (editingId) {
        await schemeService.update(editingId, fd);
        toast.success('Scheme of work entry updated successfully');
      } else {
        await schemeService.create(fd);
        toast.success('Scheme of work entry added successfully');
      }
      
      cancelEdit();
      fetchSchemes();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save scheme entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/schemes')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-header-title">Manage Scheme of Work</h1>
            <p className="page-header-subtitle">Edit course schedules and study materials</p>
          </div>
        </div>
      </div>

      {/* Select Filters */}
      <div className="card mb-6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select 
              className="form-select"
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); cancelEdit(); }}
            >
              {subjects.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Class</label>
            <select 
              className="form-select"
              value={selectedClass}
              onChange={(e) => { setSelectedClass(e.target.value); cancelEdit(); }}
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Term</label>
            <select 
              className="form-select"
              value={selectedTerm}
              onChange={(e) => { setSelectedTerm(e.target.value); cancelEdit(); }}
            >
              <option value="FIRST">First Term</option>
              <option value="SECOND">Second Term</option>
              <option value="THIRD">Third Term</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Session</label>
            <select 
              className="form-select"
              value={selectedSession}
              onChange={(e) => { setSelectedSession(e.target.value); cancelEdit(); }}
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '24px' }} className="grid-2">
        
        {/* Form Column */}
        <div className="card">
          <h3 className="mb-4">{editingId ? 'Edit Week Schedule' : 'Add Week Schedule'}</h3>
          
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '16px' }} className="mb-4">
              <div className="form-group">
                <label className="form-label">Week <span className="required">*</span></label>
                <input 
                  type="number" 
                  className={`form-input ${errors.week ? 'error' : ''}`}
                  placeholder="e.g. 1"
                  min="1"
                  max="15"
                  {...register('week', { required: 'Week number is required' })}
                />
                {errors.week && <span className="form-error">{errors.week.message}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Topic / Lesson Title <span className="required">*</span></label>
                <input 
                  type="text" 
                  className={`form-input ${errors.topic ? 'error' : ''}`}
                  placeholder="e.g., Introduction to Algebra"
                  {...register('topic', { required: 'Topic name is required' })}
                />
                {errors.topic && <span className="form-error">{errors.topic.message}</span>}
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Objectives</label>
              <textarea 
                className="form-textarea"
                placeholder="Describe what the students will learn during this week..."
                {...register('objectives')}
              />
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Teaching Notes (Text)</label>
              <textarea 
                className="form-textarea"
                style={{ minHeight: '150px' }}
                placeholder="Type or paste the lecture notes content here..."
                {...register('notesText')}
              />
            </div>

            {/* Note document attachments upload */}
            <div className="form-group mb-6">
              <label className="form-label">Attachment (PDF/Word/Images)</label>
              
              {!file && existingFileName && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} style={{ color: 'var(--primary-light)' }} />
                    <span className="truncate" style={{ maxWidth: '280px' }}>{existingFileName}</span>
                  </span>
                  <button 
                    type="button" 
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 8px' }}
                    onClick={() => setExistingFileName('')}
                  >
                    Replace
                  </button>
                </div>
              )}

              {(!existingFileName || file) && (
                <div style={{ position: 'relative' }}>
                  <input 
                    type="file" 
                    id="file-upload"
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <label 
                    htmlFor="file-upload"
                    className="form-input"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '10px', 
                      padding: '24px', 
                      border: '2px dashed var(--border)',
                      background: 'rgba(255,255,255,0.01)',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      transition: 'border-color 0.2s'
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Upload size={20} className="text-muted" />
                    <span className="text-sm font-semibold">
                      {file ? file.name : 'Upload notes document (Max 10MB)'}
                    </span>
                  </label>
                  
                  {file && (
                    <button 
                      type="button" 
                      onClick={() => setFile(null)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
                ) : (
                  <><Save size={16} /> {editingId ? 'Update Entry' : 'Add Entry'}</>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Existing list column */}
        <div className="card" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <h3 className="mb-4">Weekly Schedule</h3>

          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary-light)' }} />
            </div>
          ) : schemes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              No weeks added for this term yet. Use the form to add the first week's content.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {schemes.map(sch => (
                <div 
                  key={sch.id} 
                  style={{ 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '12px 16px',
                    background: editingId === sch.id ? 'rgba(79,70,229,0.05)' : 'var(--bg-elevated)',
                    borderColor: editingId === sch.id ? 'var(--primary)' : 'var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-primary text-xs" style={{ padding: '1px 6px' }}>Week {sch.week}</span>
                      {sch.notesFile && <FileText size={12} style={{ color: 'var(--primary-light)' }} title="Has document attachment" />}
                    </div>
                    <div className="font-semibold text-sm truncate text-primary">{sch.topic}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button 
                      className="btn btn-secondary btn-icon btn-sm" 
                      title="Edit"
                      onClick={() => startEdit(sch)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      className="btn btn-danger btn-icon btn-sm" 
                      title="Delete"
                      onClick={() => handleDelete(sch.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

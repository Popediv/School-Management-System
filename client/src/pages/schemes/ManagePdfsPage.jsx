import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { subjectService, classService, subjectPdfService } from '../../services';
import { toast } from 'react-toastify';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import { 
  ArrowLeft, Upload, Trash2, FileText, X, 
  RefreshCw, CheckCircle, BookMarked, AlertCircle
} from 'lucide-react';
import GroupedSubjectSelect from '../../components/GroupedSubjectSelect';

export default function ManagePdfsPage() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const [existingPdf, setExistingPdf] = useState(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load subjects and classes
  useEffect(() => {
    Promise.all([subjectService.getAll(), classService.getAll()])
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
      .catch(() => toast.error('Failed to load subjects and classes'));
  }, []);

  const fetchExistingPdf = () => {
    if (!selectedSubject || !selectedClass) return;
    setLoading(true);
    subjectPdfService.getAll({
      subjectId: selectedSubject,
      classId: selectedClass
    })
      .then(res => {
        const pdfs = res.data.pdfs || [];
        setExistingPdf(pdfs.length > 0 ? pdfs[0] : null);
      })
      .catch(() => setExistingPdf(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchExistingPdf();
    setFile(null);
    setLabel('');
  }, [selectedSubject, selectedClass, selectedTerm, selectedSession]);

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a PDF file first');
    if (!selectedSubject || !selectedClass) return toast.error('Please select a subject and class');

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('subjectId', selectedSubject);
      fd.append('classId', selectedClass);
      fd.append('pdfFile', file);
      if (label.trim()) fd.append('label', label.trim());

      await subjectPdfService.upload(fd);
      toast.success(existingPdf ? 'PDF replaced successfully!' : 'PDF uploaded successfully!');
      setFile(null);
      setLabel('');
      fetchExistingPdf();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingPdf) return;
    if (!window.confirm('Are you sure you want to remove this class notes PDF?')) return;

    setDeleting(true);
    try {
      await subjectPdfService.delete(existingPdf.id);
      toast.success('PDF removed successfully');
      setExistingPdf(null);
      setFile(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const termLabel = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' };
  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || '';
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-icon" onClick={() => navigate('/schemes')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-header-title">Manage Class Notes PDFs</h1>
            <p className="page-header-subtitle">Upload subject PDF notes for each class (covers all terms)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <GroupedSubjectSelect
              subjects={subjects}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              selectedClassName={classes.find(c => c.id === selectedClass)?.name || ''}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Class</label>
            <select 
              className="form-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
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
              onChange={(e) => setSelectedTerm(e.target.value)}
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
              onChange={(e) => setSelectedSession(e.target.value)}
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-2">
        
        {/* Upload Panel */}
        <div className="card">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Upload size={18} style={{ color: 'var(--primary-light)' }} />
            {existingPdf ? 'Replace Class Notes PDF' : 'Upload Class Notes PDF'}
          </h3>

          {existingPdf && (
            <div 
              className="mb-4"
              style={{ 
                background: 'rgba(34,197,94,0.08)', 
                border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.85rem'
              }}
            >
              <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
              <div>
                <div className="font-semibold" style={{ color: '#22c55e' }}>PDF already uploaded</div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  Uploading a new file will replace the existing one.
                </div>
              </div>
            </div>
          )}

          <div className="form-group mb-4">
            <label className="form-label">Display Label (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder={`e.g. ${selectedSubjectName} ${termLabel[selectedTerm]} Notes`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              If left blank, the subject name and term will be used.
            </span>
          </div>

          <div className="form-group mb-6">
            <label className="form-label">PDF File <span className="required">*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="file"
                id="pdf-upload"
                style={{ display: 'none' }}
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
              <label
                htmlFor="pdf-upload"
                className="form-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '28px 24px',
                  border: `2px dashed ${file ? 'var(--primary)' : 'var(--border)'}`,
                  background: file ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.01)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  transition: 'all 0.2s',
                  flexDirection: 'column',
                }}
              >
                <FileText size={28} style={{ color: file ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div className="font-semibold text-sm" style={{ color: file ? 'var(--primary-light)' : 'var(--text-primary)' }}>
                    {file ? file.name : 'Click to select PDF file'}
                  </div>
                  {file && (
                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  )}
                  {!file && (
                    <div className="text-muted" style={{ fontSize: '0.78rem', marginTop: '2px' }}>
                      PDF only · Max 50 MB
                    </div>
                  )}
                </div>
              </label>
              {file && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleUpload}
              disabled={uploading || !file}
            >
              {uploading ? (
                <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
              ) : (
                <><Upload size={16} /> {existingPdf ? 'Replace PDF' : 'Upload PDF'}</>
              )}
            </button>
          </div>
        </div>

        {/* Current PDF Status */}
        <div className="card">
          <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookMarked size={18} style={{ color: 'var(--primary-light)' }} />
            Current Status
          </h3>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', padding: '20px 0' }}>
              <RefreshCw size={16} className="animate-spin" />
              <span>Checking...</span>
            </div>
          ) : existingPdf ? (
            <div>
              {/* Subject / Class Info */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ 
                  background: 'var(--bg-elevated)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ padding: '10px', background: 'rgba(99,102,241,0.12)', borderRadius: '8px', color: 'var(--primary-light)', flexShrink: 0 }}>
                      <FileText size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-semibold text-primary" style={{ marginBottom: '4px' }}>
                        {existingPdf.label || `${selectedSubjectName} — ${termLabel[selectedTerm]} Notes`}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                        {selectedClassName} · {termLabel[selectedTerm]} · {selectedSession}
                      </div>
                      <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        background: 'rgba(34,197,94,0.1)',
                        color: '#22c55e',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        <CheckCircle size={11} /> Active
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ 
                background: 'rgba(239,68,68,0.05)', 
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.83rem',
                color: 'var(--text-secondary)',
                marginBottom: '16px'
              }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                Removing this PDF will immediately hide class notes from all teachers for this subject.
              </div>

              <button
                className="btn btn-danger"
                style={{ width: '100%' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                ) : (
                  <><Trash2 size={15} /> Remove PDF</>
                )}
              </button>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '50%' }}>
                <FileText size={28} />
              </div>
              <div>
                <div className="font-semibold" style={{ marginBottom: '4px' }}>No PDF Uploaded</div>
                <div style={{ fontSize: '0.82rem' }}>
                  Upload a PDF on the left to make class notes available to teachers for{' '}
                  <strong>{selectedSubjectName}</strong> — {selectedClassName}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="card mt-6" style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary-light)', fontSize: '0.9rem' }}>
          <AlertCircle size={16} /> How Class Notes Work
        </h4>
        <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <li>Upload one PDF per <strong>Subject → Class</strong> combination. This PDF should cover notes from 1st term through 3rd term.</li>
          <li>Teachers and admins can <strong>view</strong> the PDF inline inside the app — they <strong>cannot download</strong> it.</li>
          <li>Students and parents do <strong>not</strong> have access to class notes PDFs.</li>
          <li>To update, simply upload a new file — it will automatically replace the old one.</li>
          <li>To serve notes for different classes (e.g. JSS1A and JSS1B), upload separately for each class.</li>
        </ul>
      </div>
    </div>
  );
}

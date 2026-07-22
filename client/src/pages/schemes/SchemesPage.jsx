import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subjectService, classService, schemeService, subjectPdfService } from '../../services';
import { toast } from 'react-toastify';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import { 
  BookOpen, Plus, FileText, Lock, Calendar, 
  ChevronDown, ChevronUp, AlertCircle, BookOpenCheck,
  Eye, X, FileSearch, BookMarked
} from 'lucide-react';
import GroupedSubjectSelect from '../../components/GroupedSubjectSelect';

export default function SchemesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('FIRST');
  const [selectedSession, setSelectedSession] = useState(CURRENT_SESSION);
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  // PDF viewer state
  const [subjectPdf, setSubjectPdf] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');

  const isAdmin = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(user?.role);
  const isRestricted = user?.role === 'STUDENT' || user?.role === 'PARENT';

  useEffect(() => {
    // Load subjects and classes
    Promise.all([
      subjectService.getAll(),
      classService.getAll()
    ])
      .then(([subRes, classRes]) => {
        setSubjects(subRes.data.subjects || []);
        if (subRes.data.subjects?.length > 0) {
          setSelectedSubject(subRes.data.subjects[0].id);
        }
        setClasses(classRes.data.classes || []);
        if (classRes.data.classes?.length > 0) {
          setSelectedClass(classRes.data.classes[0].id);
        }
      })
      .catch(err => {
        toast.error('Failed to load subjects and classes');
        console.error(err);
      });
  }, []);

  const fetchSchemes = () => {
    if (!selectedSubject || !selectedClass) return;
    setLoading(true);
    schemeService.getAll({
      subjectId: selectedSubject,
      classId: selectedClass,
      term: selectedTerm,
      session: selectedSession
    })
      .then(res => {
        setSchemes(res.data.schemes || []);
        setExpandedWeeks({});
      })
      .catch(err => {
        toast.error('Failed to load schemes of work');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const fetchSubjectPdf = () => {
    if (!selectedSubject || !selectedClass || isRestricted) {
      setSubjectPdf(null);
      return;
    }
    subjectPdfService.getAll({
      subjectId: selectedSubject,
      classId: selectedClass,
      term: selectedTerm
    })
      .then(res => {
        const pdfs = res.data.pdfs || [];
        setSubjectPdf(pdfs.length > 0 ? pdfs[0] : null);
      })
      .catch(() => setSubjectPdf(null));
  };

  useEffect(() => {
    fetchSchemes();
    fetchSubjectPdf();
  }, [selectedSubject, selectedClass, selectedTerm, selectedSession]);

  const toggleWeek = (id) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openPdfViewer = () => {
    if (!subjectPdf) return;
    // If stored on Cloudinary, use the URL directly; otherwise route through backend
    const url = subjectPdf.pdfFile?.startsWith('http')
      ? subjectPdf.pdfFile
      : subjectPdfService.getViewUrl(subjectPdf.id);
    setPdfUrl(url);
    setShowPdfViewer(true);
  };

  const closePdfViewer = () => {
    setShowPdfViewer(false);
    setPdfUrl('');
  };

  const termLabel = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' };
  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || '';
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  return (
    <div className="animate-fade-in">
      {/* PDF Viewer Modal */}
      {showPdfViewer && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Modal Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', background: 'rgba(99,102,241,0.15)', borderRadius: '8px', color: 'var(--primary-light)' }}>
                <BookMarked size={18} />
              </div>
              <div>
                <div className="font-semibold text-primary" style={{ fontSize: '1rem' }}>
                  {selectedSubjectName} — Class Notes
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  {selectedClassName} · {termLabel[selectedTerm]} · {selectedSession} · Read-only
                </div>
              </div>
            </div>
            <button
              onClick={closePdfViewer}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem'
              }}
            >
              <X size={16} /> Close
            </button>
          </div>

          {/* PDF Iframe */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <iframe
              src={pdfUrl}
              title="Class Notes PDF"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
            />
            {/* Overlay to block right-click context menu on the iframe area */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60px',
                // Covers the bottom bar of browser PDF viewer where download appears
                background: 'transparent',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Read-only notice */}
          <div style={{
            padding: '8px 20px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            <Lock size={12} />
            <span>This document is for viewing only. Downloading or printing is not permitted.</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-header-title">Scheme of Work</h1>
          <p className="page-header-subtitle">Academic curriculum schedule and lesson outlines</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass, selectedTerm, selectedSession } })}
            >
              <FileText size={16} />
              <span>Manage Class Notes</span>
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedClass, selectedTerm, selectedSession } })}
            >
              <Plus size={16} />
              <span>Manage Schemes</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Card */}
      <div className="card mb-6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <GroupedSubjectSelect
              subjects={subjects}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              selectedClassName={selectedClassName}
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
            <label className="form-label">Academic Session</label>
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

      {/* Class Notes PDF Banner */}
      {!isRestricted && subjectPdf && (
        <div 
          className="card mb-6"
          style={{ 
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ 
              padding: '12px', 
              background: 'rgba(99,102,241,0.15)', 
              borderRadius: '10px',
              color: 'var(--primary-light)',
              flexShrink: 0
            }}>
              <FileSearch size={24} />
            </div>
            <div>
              <div className="font-semibold text-primary" style={{ fontSize: '1rem', marginBottom: '2px' }}>
                Class Notes Available
              </div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>
                {subjectPdf.label || `${selectedSubjectName} Notes`}
              </div>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                {selectedClassName}
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={openPdfViewer}
            style={{ gap: '8px', flexShrink: 0 }}
          >
            <Eye size={16} />
            <span>View Class Notes</span>
          </button>
        </div>
      )}

      {/* No PDF notice for admins only */}
      {isAdmin && !subjectPdf && selectedSubject && selectedClass && (
        <div 
          className="card mb-6"
          style={{ 
            border: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            opacity: 0.7
          }}
        >
          <FileText size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span className="text-muted" style={{ fontSize: '0.875rem' }}>
            No class notes PDF uploaded for this subject/class yet.{' '}
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass, selectedTerm, selectedSession } })}
            >
              Upload one now
            </button>
          </span>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '100px', width: '100%' }}></div>
          ))}
        </div>
      ) : schemes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '16px', borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <BookOpenCheck size={36} />
          </div>
          <h3 className="text-primary">No Scheme of Work Found</h3>
          <p className="text-secondary" style={{ maxWidth: '400px' }}>
            There is no curriculum schedule uploaded for this subject in the selected term.
          </p>
          {isAdmin && (
            <button 
              className="btn btn-secondary mt-2"
              onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedTerm, selectedSession } })}
            >
              <Plus size={16} /> Add First Week
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schemes.map((scheme) => {
            const isExpanded = expandedWeeks[scheme.id];
            const hasNotes = scheme.notesText || scheme.notesFile;

            return (
              <div key={scheme.id} className="card" style={{ transition: 'all 0.2s', borderLeft: '4px solid var(--primary)' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: hasNotes && !isRestricted ? 'pointer' : 'default' }}
                  onClick={() => hasNotes && !isRestricted && toggleWeek(scheme.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span className="badge badge-primary">Week {scheme.week}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} /> Term {scheme.term}
                      </span>
                    </div>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: '6px', color: 'var(--text-primary)' }}>{scheme.topic}</h2>
                    {scheme.objectives && (
                      <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
                        <strong>Objectives:</strong> {scheme.objectives}
                      </p>
                    )}
                  </div>

                  {hasNotes && !isRestricted && (
                    <button 
                      className="btn btn-secondary btn-icon" 
                      style={{ alignSelf: 'center' }}
                      onClick={(e) => { e.stopPropagation(); toggleWeek(scheme.id); }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  )}
                </div>

                {/* Notes and materials section */}
                {isExpanded && !isRestricted && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    {scheme.notesText && (
                      <div className="mb-4">
                        <h4 className="text-primary mb-2" style={{ fontSize: '0.95rem' }}>Lecture Notes</h4>
                        <div 
                          style={{ 
                            background: 'var(--bg-elevated)', 
                            padding: '16px', 
                            borderRadius: 'var(--radius-md)', 
                            fontSize: '0.9rem',
                            whiteSpace: 'pre-line',
                            color: 'var(--text-primary)'
                          }}
                        >
                          {scheme.notesText}
                        </div>
                      </div>
                    )}

                    {scheme.notesFile && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.3)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ padding: '8px', background: 'rgba(99,102,241,0.1)', color: 'var(--primary-light)', borderRadius: '6px' }}>
                          <FileText size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">Attachment Available</div>
                          <div className="text-xs text-muted">Document uploaded by administrator</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Restricted alert for students and parents */}
                {isRestricted && (
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <Lock size={12} />
                    <span>Detailed notes are restricted to teachers and administrators. Contact your class teacher for study materials.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subjectService, classService, schemeService, subjectPdfService } from '../../services';
import { toast } from 'react-toastify';
import {
  BookOpen, Plus, FileText, Lock, Calendar,
  ChevronDown, ChevronUp, AlertCircle, BookOpenCheck,
  Eye, X, FileSearch, BookMarked, Download, Printer,
  ExternalLink, Wand2, Layers
} from 'lucide-react';
import GroupedSubjectSelect from '../../components/GroupedSubjectSelect';

export default function SchemesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({});

  // PDF viewer state
  const [subjectPdf, setSubjectPdf] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showTocSidebar, setShowTocSidebar] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [termPages, setTermPages] = useState({ FIRST: 1, SECOND: 10, THIRD: 20 });
  const [extracting, setExtracting] = useState(false);

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
      classId: selectedClass
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
  }, [selectedSubject, selectedClass]);

  const toggleWeek = (id) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openPdfViewer = () => {
    if (!subjectPdf) return;
    const url = subjectPdf.pdfFile?.startsWith('http')
      ? subjectPdf.pdfFile
      : subjectPdfService.getViewUrl(subjectPdf.id);
    setPdfUrl(url);
    setActivePage(1);
    setShowPdfViewer(true);
  };

  const closePdfViewer = () => {
    setShowPdfViewer(false);
    setPdfUrl('');
    setActivePage(1);
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.target = '_blank';
    link.download = `${selectedSubjectName}_${selectedClassName}_ClassNotes.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    if (!pdfUrl) return;
    const printWin = window.open(pdfUrl, '_blank');
    if (printWin) {
      printWin.focus();
    }
  };

  const jumpToPage = (pageNum) => {
    const page = Math.max(1, parseInt(pageNum) || 1);
    setActivePage(page);
  };

  const jumpToTermPage = (termName) => {
    const page = termPages[termName] || 1;
    jumpToPage(page);
  };

  const handleTermPageChange = (termName, pageNum) => {
    const page = Math.max(1, parseInt(pageNum) || 1);
    setTermPages(prev => ({
      ...prev,
      [termName]: page
    }));
  };

  const handleAutoExtractAll = async () => {
    if (!selectedSubject || !selectedClass) return;
    if (!window.confirm('Scan the uploaded Class Notes PDF to automatically extract and populate weekly topics for ALL terms? Existing entries will be updated.')) return;

    setExtracting(true);
    try {
      const res = await schemeService.extractFromPdf({
        subjectId: selectedSubject,
        classId: selectedClass,
        term: 'ALL'
      });
      toast.success(res.data.message || 'Schemes of work extracted successfully!');
      fetchSchemes();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to extract schemes from PDF');
    } finally {
      setExtracting(false);
    }
  };

  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name || '';
  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';

  // Group schemes by Term
  const termOrder = ['FIRST', 'SECOND', 'THIRD'];
  const termLabel = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' };

  const groupedSchemes = {
    FIRST: schemes.filter(s => s.term === 'FIRST').sort((a, b) => a.week - b.week),
    SECOND: schemes.filter(s => s.term === 'SECOND').sort((a, b) => a.week - b.week),
    THIRD: schemes.filter(s => s.term === 'THIRD').sort((a, b) => a.week - b.week),
  };

  return (
    <div className="animate-fade-in">
      {/* PDF Viewer Modal */}
      {showPdfViewer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Modal Header Toolbar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ padding: '8px', background: 'rgba(99,102,241,0.15)', borderRadius: '8px', color: 'var(--primary-light)' }}>
                <BookMarked size={20} />
              </div>
              <div>
                <div className="font-semibold text-primary" style={{ fontSize: '0.98rem' }}>
                  {selectedSubjectName} — Class Notes
                </div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                  {selectedClassName} · Full Academic Year Notes
                </div>
              </div>
            </div>

            {/* Download, Print & Close Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadPdf}
                title="Download PDF file to your device"
                style={{ gap: '6px', fontSize: '0.82rem' }}
              >
                <Download size={15} />
                <span className="hidden-mobile">Download</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handlePrintPdf}
                title="Print PDF document"
                style={{ gap: '6px', fontSize: '0.82rem' }}
              >
                <Printer size={15} />
                <span className="hidden-mobile">Print</span>
              </button>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                title="Open PDF directly in full browser tab"
                style={{ gap: '6px', fontSize: '0.82rem', textDecoration: 'none' }}
              >
                <ExternalLink size={15} />
                <span className="hidden-mobile">Fullscreen</span>
              </a>
              <button
                onClick={closePdfViewer}
                className="btn btn-secondary btn-icon btn-sm"
                title="Close viewer"
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Clean Native PDF Viewport */}
          <div style={{ flex: 1, position: 'relative', height: '100%', background: '#1a1d24' }}>
            <iframe
              src={pdfUrl}
              title="Class Notes PDF"
              style={{
                width: '100%',
                height: '100%',
                minHeight: '85vh',
                border: 'none',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Scheme of Work</h1>
          <p className="page-header-subtitle">Academic curriculum schedule and lesson outlines for all terms</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'nowrap', flexShrink: 0 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass } })}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <FileText size={15} />
              <span>Manage Class Notes</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedClass } })}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Plus size={15} />
              <span>Manage Schemes</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters Card — Session & Term Removed */}
      <div className="card mb-6">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
        </div>
      </div>

      {/* Class Notes PDF Banner */}
      {!isRestricted && subjectPdf && (
        <div
          className="card mb-6"
          style={{
            padding: '14px 18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            borderRadius: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} className="text-primary" />
            <div>
              <span className="font-semibold text-primary" style={{ fontSize: '0.92rem' }}>
                Class Notes PDF Available
              </span>
              <span className="text-muted ml-2" style={{ fontSize: '0.8rem' }}>
                ({selectedSubjectName} · {selectedClassName})
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={openPdfViewer}
            style={{ gap: '6px' }}
          >
            <Eye size={15} />
            <span>Open Class Notes PDF</span>
          </button>
        </div>
      )}

      {/* No PDF notice for admins */}
      {isAdmin && !subjectPdf && selectedSubject && selectedClass && (
        <div
          className="card mb-6"
          style={{
            border: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            opacity: 0.8
          }}
        >
          <FileText size={16} className="text-muted" />
          <span className="text-muted text-xs">
            No class notes PDF uploaded yet.{' '}
            <button
              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass } })}
            >
              Upload PDF
            </button>
          </span>
        </div>
      )}

      {/* Content Area — Categorized by Terms */}
      {
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card skeleton" style={{ height: '70px', width: '100%' }}></div>
            ))}
          </div>
        ) : schemes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <BookOpenCheck size={32} className="text-muted" />
            <h3 className="text-primary" style={{ fontSize: '1.05rem', margin: 0 }}>No Scheme of Work Found</h3>
            <p className="text-secondary text-xs" style={{ maxWidth: '400px', margin: 0 }}>
              No curriculum items available for {selectedSubjectName || 'this subject'} in {selectedClassName || 'this class'}.
            </p>
            {isAdmin && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '8px' }}
                onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedClass } })}
              >
                <Plus size={14} /> Add Week Manually
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {termOrder.map((tKey) => {
              const termSchemes = groupedSchemes[tKey] || [];
              if (termSchemes.length === 0) return null;

              return (
                <div key={tKey} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Simple Term Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingBottom: '6px',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                      {termLabel[tKey]}
                    </h2>
                    <span className="text-xs text-muted">
                      ({termSchemes.length} {termSchemes.length === 1 ? 'topic' : 'topics'})
                    </span>
                  </div>

                  {/* Weeks List under this Term */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {termSchemes.map((scheme) => {
                      const isExpanded = expandedWeeks[scheme.id];
                      const hasNotes = scheme.notesText && scheme.notesText.trim().length > 0;

                      return (
                        <div
                          key={scheme.id}
                          className="card"
                          style={{
                            borderLeft: '4px solid var(--primary)',
                            padding: '16px 20px',
                            transition: 'box-shadow 0.2s',
                          }}
                        >
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Week badge + term label */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span className="badge badge-primary">Week {scheme.week}</span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={12} />
                                  {termLabel[scheme.term]}
                                </span>
                              </div>

                              {/* Topic title */}
                              <h3 style={{
                                fontSize: '1.1rem',
                                fontWeight: 700,
                                margin: '0 0 6px',
                                color: 'var(--text-primary)',
                                lineHeight: 1.35,
                                textTransform: 'capitalize',
                                wordBreak: 'break-word'
                              }}>
                                {scheme.topic.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                              </h3>

                              {/* Objectives */}
                              {scheme.objectives && scheme.objectives.trim() && (
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>Objectives: </strong>
                                  {scheme.objectives}
                                </p>
                              )}
                            </div>

                            {/* Toggle button */}
                            {hasNotes && !isRestricted && (
                              <button
                                className="btn btn-secondary btn-icon"
                                style={{ alignSelf: 'flex-start', flexShrink: 0, padding: '6px 8px' }}
                                onClick={() => toggleWeek(scheme.id)}
                                title={isExpanded ? 'Hide notes' : 'Read notes'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            )}
                          </div>

                          {/* Collapsible notes */}
                          {isExpanded && hasNotes && !isRestricted && (
                            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                              <p className="text-primary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>
                                Lecture Notes
                              </p>
                              <div style={{
                                background: 'var(--bg-elevated)',
                                padding: '14px 16px',
                                borderRadius: '8px',
                                fontSize: '0.875rem',
                                whiteSpace: 'pre-line',
                                color: 'var(--text-primary)',
                                maxHeight: '320px',
                                overflowY: 'auto',
                                lineHeight: 1.65,
                              }}>
                                {scheme.notesText}
                              </div>
                            </div>
                          )}

                          {/* Restricted notice */}
                          {isRestricted && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              <Lock size={12} />
                              <span>Detailed notes are restricted. Contact your class teacher for study materials.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div >
  );
}

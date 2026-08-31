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
  const [showToc, setShowToc] = useState(true);
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfPageParam, setPdfPageParam] = useState('');
  const [targetPageInput, setTargetPageInput] = useState('');
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
    setPdfPageParam('#page=1');
    setTargetPageInput('1');
    setShowPdfViewer(true);
  };

  const closePdfViewer = () => {
    setShowPdfViewer(false);
    setPdfUrl('');
    setPdfPageParam('');
    setTargetPageInput('');
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
    setTargetPageInput(page.toString());
    setPdfPageParam(`#page=${page}&reload=${Date.now()}`);
  };

  const jumpToTermPage = (termName) => {
    let pageNum = 1;
    if (termName === 'SECOND') pageNum = 10;
    if (termName === 'THIRD') pageNum = 20;
    jumpToPage(pageNum);
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

            {/* Term Navigation, Table of Contents & Page Jump Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${showToc ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setShowToc(!showToc)}
                title="Toggle Table of Contents / Document Bookmarks Sidebar"
                style={{ gap: '6px', fontSize: '0.8rem' }}
              >
                <Layers size={15} />
                <span>Outline</span>
              </button>

              <span className="text-xs text-muted font-medium ml-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Jump to:
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => jumpToTermPage('FIRST')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                1st Term
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => jumpToTermPage('SECOND')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                2nd Term
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => jumpToTermPage('THIRD')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                3rd Term
              </button>

              {/* Direct Page Number Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  jumpToPage(targetPageInput);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
              >
                <span className="text-xs text-muted">Page:</span>
                <input
                  type="number"
                  min="1"
                  value={targetPageInput}
                  onChange={(e) => setTargetPageInput(e.target.value)}
                  style={{
                    width: '52px',
                    padding: '3px 6px',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    textAlign: 'center'
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                >
                  Go
                </button>
              </form>
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
                title="Open PDF directly in full browser tab for responsive scrolling"
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

          {/* Main Viewer Body with Collapsible Table of Contents Sidebar */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {/* Native In-App Table of Contents / Bookmarks Sidebar */}
            {showToc && (
              <div
                style={{
                  width: '280px',
                  maxWidth: '85vw',
                  background: 'var(--bg-surface)',
                  borderRight: '1px solid var(--border)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                  zIndex: 10
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-elevated)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookMarked size={16} className="text-primary" /> Table of Contents
                  </span>
                  <button
                    onClick={() => setShowToc(false)}
                    className="btn btn-secondary btn-icon btn-sm"
                    style={{ padding: '2px 4px' }}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {termOrder.map(termKey => {
                    const list = groupedSchemes[termKey] || [];
                    const termStartPage = termKey === 'FIRST' ? 1 : (termKey === 'SECOND' ? 10 : 20);

                    return (
                      <div key={termKey} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div
                          onClick={() => jumpToTermPage(termKey)}
                          style={{
                            padding: '8px 10px',
                            background: 'rgba(99,102,241,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            color: 'var(--primary-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{termLabel[termKey]}</span>
                          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Pg {termStartPage}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '6px' }}>
                          {list.map(s => {
                            const approxPg = Math.max(1, termStartPage + Math.floor((s.week - 1) * 0.8));
                            return (
                              <div
                                key={s.id}
                                onClick={() => jumpToPage(approxPg)}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer',
                                  background: 'var(--bg-elevated)',
                                  border: '1px solid var(--border)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  transition: 'all 0.15s ease'
                                }}
                                className="hover:border-primary"
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Week {s.week}</span>
                                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>Pg {approxPg}</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {s.topic}
                                </div>
                              </div>
                            );
                          })}

                          {list.length === 0 && (
                            <div className="text-xs text-muted italic" style={{ padding: '4px 6px' }}>
                              No topics extracted yet
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PDF Viewport */}
            <div style={{
              flex: 1,
              position: 'relative',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              background: '#1a1d24'
            }}>
              <iframe
                key={pdfPageParam || 'pdf-viewport'}
                src={pdfUrl + pdfPageParam}
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
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Scheme of Work</h1>
          <p className="page-header-subtitle">Academic curriculum schedule and lesson outlines for all terms</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass } })}
            >
              <FileText size={16} />
              <span>Manage Class Notes</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedClass } })}
            >
              <Plus size={16} />
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
                Class Notes PDF Available
              </div>
              <div className="text-secondary" style={{ fontSize: '0.85rem' }}>
                {subjectPdf.label || `${selectedSubjectName} Notes`} — Covers 1st, 2nd & 3rd Terms
              </div>
              <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                {selectedClassName}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button
                className="btn btn-secondary"
                onClick={handleAutoExtractAll}
                disabled={extracting}
                style={{ gap: '8px', flexShrink: 0 }}
                title="Automatically scan and extract weekly topics from PDF into scheme of work"
              >
                {extracting ? (
                  <span className="animate-spin" style={{ width: 14, height: 14, border: '2px solid var(--primary-light)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                ) : (
                  <Wand2 size={16} />
                )}
                <span>Extract Scheme from PDF</span>
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={openPdfViewer}
              style={{ gap: '8px', flexShrink: 0 }}
            >
              <Eye size={16} />
              <span>View Class Notes</span>
            </button>
          </div>
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
              onClick={() => navigate('/schemes/manage-pdfs', { state: { selectedSubject, selectedClass } })}
            >
              Upload one now
            </button>
          </span>
        </div>
      )}

      {/* Content Area — Categorized by Terms */}
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
          <p className="text-secondary" style={{ maxWidth: '450px' }}>
            There is no curriculum schedule uploaded for {selectedSubjectName || 'this subject'} in {selectedClassName || 'this class'}.
          </p>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {subjectPdf && (
                <button
                  className="btn btn-primary"
                  onClick={handleAutoExtractAll}
                  disabled={extracting}
                >
                  <Wand2 size={16} /> Auto-Extract from PDF
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/schemes/manage', { state: { selectedSubject, selectedClass } })}
              >
                <Plus size={16} /> Add Week Manually
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {termOrder.map((tKey) => {
            const termSchemes = groupedSchemes[tKey] || [];
            if (termSchemes.length === 0) return null;

            return (
              <div key={tKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Term Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid var(--border)',
                  color: 'var(--primary-light)'
                }}>
                  <BookOpen size={20} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {termLabel[tKey]}
                  </h2>
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                    {termSchemes.length} {termSchemes.length === 1 ? 'Week' : 'Weeks'}
                  </span>
                </div>

                {/* Weeks List under this Term */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {termSchemes.map((scheme) => {
                    const isExpanded = expandedWeeks[scheme.id];
                    const hasNotes = scheme.notesText || scheme.notesFile;

                    return (
                      <div
                        key={scheme.id}
                        className="card"
                        style={{
                          transition: 'all 0.2s',
                          borderLeft: '4px solid var(--primary)'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            cursor: hasNotes && !isRestricted ? 'pointer' : 'default'
                          }}
                          onClick={() => hasNotes && !isRestricted && toggleWeek(scheme.id)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                              <span className="badge badge-primary">Week {scheme.week}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={12} /> {termLabel[scheme.term]}
                              </span>
                            </div>
                            <h3 style={{ fontSize: '1.15rem', marginBottom: '6px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {scheme.topic}
                            </h3>
                            {scheme.objectives && (
                              <p className="text-secondary" style={{ fontSize: '0.88rem', margin: 0 }}>
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
                                <h4 className="text-primary mb-2" style={{ fontSize: '0.92rem' }}>Lecture Notes</h4>
                                <div
                                  style={{
                                    background: 'var(--bg-elevated)',
                                    padding: '16px',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.88rem',
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, CheckSquare, Square, Filter, Users } from 'lucide-react';
import api from '../../services/api';
import { ReportCardDocument, PRINT_CORE_CSS, TERMS } from '../../components/results/ReportCardDocument';

const currentSession = () => {
  const now = new Date(), m = now.getMonth() + 1;
  const y = m >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    session: `${y}/${y + 1}`,
    term: m >= 9 ? 'FIRST' : m >= 5 ? 'THIRD' : 'SECOND',
    options: [`${y - 1}/${y}`, `${y}/${y + 1}`, `${y + 1}/${y + 2}`],
  };
};

export default function BulkReportCardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const initialClassId = searchParams.get('classId') || '';

  const def = useMemo(currentSession, []);
  const [session, setSession] = useState(searchParams.get('session') || def.session);
  const [term, setTerm] = useState(searchParams.get('term') || def.term);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedStudentIds, setSelectedStudentIds] = useState(
    idsParam ? idsParam.split(',').filter(Boolean) : []
  );

  // 1. Fetch available classes
  const { data: classesData = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => api.get('/classes').then(r => r.data?.data || r.data || []),
  });

  // 2. Fetch school settings (logo & metadata)
  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO SCHOOLS INTERNATIONAL' },
  });

  // 3. Fetch bulk report cards
  const { data: bulkData, isLoading, isError, error } = useQuery({
    queryKey: ['bulk-report-cards', selectedClassId, idsParam, session, term],
    queryFn: async () => {
      const params = { session, term };
      if (idsParam) {
        params.studentIds = idsParam;
      } else if (selectedClassId) {
        params.classId = selectedClassId;
      } else {
        return { reportCards: [] };
      }
      return api.get('/results/bulk-report-cards', { params }).then(r => r.data);
    },
    enabled: Boolean(selectedClassId || idsParam),
  });

  const allReportCards = bulkData?.reportCards || [];

  // Initialize selected IDs if not already set by query params
  const effectiveSelectedIds = useMemo(() => {
    if (idsParam && selectedStudentIds.length === 0) {
      return idsParam.split(',').filter(Boolean);
    }
    if (!idsParam && selectedStudentIds.length === 0 && allReportCards.length > 0) {
      return allReportCards.map(rc => rc.student.id);
    }
    return selectedStudentIds;
  }, [idsParam, selectedStudentIds, allReportCards]);

  const toggleSelectAll = () => {
    if (effectiveSelectedIds.length === allReportCards.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(allReportCards.map(rc => rc.student.id));
    }
  };

  const toggleStudent = (id) => {
    if (effectiveSelectedIds.includes(id)) {
      setSelectedStudentIds(effectiveSelectedIds.filter(i => i !== id));
    } else {
      setSelectedStudentIds([...effectiveSelectedIds, id]);
    }
  };

  // Filter report cards to print only selected students
  const visibleReportCards = useMemo(() => {
    if (effectiveSelectedIds.length === 0) return [];
    return allReportCards.filter(rc => effectiveSelectedIds.includes(rc.student.id));
  }, [allReportCards, effectiveSelectedIds]);

  /* Bulletproof print function using isolated iframe for all selected cards */
  const handlePrint = () => {
    const container = document.getElementById('rc-bulk-container');
    if (!container || visibleReportCards.length === 0) {
      window.print();
      return;
    }

    const oldFrame = document.getElementById('rc-bulk-print-frame');
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = 'rc-bulk-print-frame';
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Batch Report Cards (${visibleReportCards.length} Students) - ${term} ${session}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap" rel="stylesheet">
  <style>
    ${PRINT_CORE_CSS}
    .bulk-print-wrap {
      display: flex !important;
      flex-direction: column !important;
      gap: 0 !important;
    }
    .rc-bulk-card {
      page-break-after: always !important;
      break-after: page !important;
    }
    .rc-bulk-card:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
  </style>
</head>
<body>
  <div class="bulk-print-wrap">
    ${container.innerHTML}
  </div>
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => {
        try { frame.remove(); } catch (_) {}
      }, 4000);
    }, 600);
  };

  return (
    <>
      <style>{`
        ${BULK_PAGE_CSS}
        @media print {
          .topbar, .sidebar, .rc-bulk-toolbar, .rc-checklist-panel, nav, aside {
            display: none !important;
          }
          body, html, #root, .app-layout, .main-content, .page-content {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          ${PRINT_CORE_CSS}
          .rc-bulk-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
          }
          .rc-bulk-card {
            page-break-after: always !important;
            break-after: page !important;
          }
          .rc-bulk-card:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      <div className="rc-bulk-root">
        {/* Top Control Toolbar */}
        <header className="rc-bulk-toolbar print-hidden">
          <div className="rc-bulk-tb-main">
            <Link to="/students" className="rc-bulk-back">
              <ArrowLeft size={15} /> Back to Students
            </Link>
            <h1 className="rc-bulk-title">Batch Report Cards Printing</h1>
            <p className="rc-bulk-desc">
              Generate and print official terminal report cards for an entire class or selected students in one batch.
            </p>
          </div>

          <div className="rc-bulk-filters">
            {/* Class Dropdown */}
            <div className="rc-bulk-filter-item">
              <label>Select Class</label>
              <select
                className="rc-bulk-sel"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentIds([]);
                  setSearchParams({ classId: e.target.value, session, term });
                }}
              >
                <option value="">-- Choose Class --</option>
                {classesData.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.level || 'Class'})</option>
                ))}
              </select>
            </div>

            {/* Session Dropdown */}
            <div className="rc-bulk-filter-item">
              <label>Academic Session</label>
              <select
                className="rc-bulk-sel"
                value={session}
                onChange={(e) => setSession(e.target.value)}
              >
                {def.options.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Term Dropdown */}
            <div className="rc-bulk-filter-item">
              <label>Term</label>
              <select
                className="rc-bulk-sel"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              >
                {TERMS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Print Action Button */}
            <div className="rc-bulk-action-item">
              <label>&nbsp;</label>
              <button
                className="rc-bulk-pbtn"
                onClick={handlePrint}
                disabled={visibleReportCards.length === 0 || isLoading}
              >
                <Printer size={16} />
                Print / Save PDF ({visibleReportCards.length})
              </button>
            </div>
          </div>
        </header>

        {/* Student Selection Checklist Panel */}
        {allReportCards.length > 0 && (
          <div className="rc-checklist-panel print-hidden">
            <div className="rc-checklist-head">
              <div className="rc-checklist-title">
                <Users size={16} />
                <span>Students in Batch ({effectiveSelectedIds.length} of {allReportCards.length} Selected)</span>
              </div>
              <button className="rc-checklist-toggle" onClick={toggleSelectAll}>
                {effectiveSelectedIds.length === allReportCards.length ? (
                  <>
                    <Square size={14} /> Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> Select All
                  </>
                )}
              </button>
            </div>
            <div className="rc-checklist-grid">
              {allReportCards.map((rc) => {
                const s = rc.student;
                const isChecked = effectiveSelectedIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`rc-check-item ${isChecked ? 'active' : ''}`}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                    />
                    <div className="rc-check-text">
                      <span className="rc-check-name">{s.firstName} {s.lastName}</span>
                      <span className="rc-check-meta">{s.admissionNo || 'No Adm No'}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty / Loading States */}
        {isLoading && (
          <div className="rc-bulk-state print-hidden">
            <div className="rc-bulk-spin" />
            <p>Compiling report cards for selected students...</p>
          </div>
        )}

        {isError && (
          <div className="rc-bulk-state rc-bulk-err print-hidden">
            <strong>Notice</strong>
            <p>{error?.response?.data?.message || 'Failed to load report cards for this class.'}</p>
          </div>
        )}

        {!isLoading && !selectedClassId && !idsParam && (
          <div className="rc-bulk-state print-hidden">
            <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <strong>No Class Selected</strong>
            <p>Please select a class from the dropdown above to load and print all student report cards.</p>
          </div>
        )}

        {!isLoading && (selectedClassId || idsParam) && allReportCards.length === 0 && (
          <div className="rc-bulk-state print-hidden">
            <strong>No Results Found</strong>
            <p>No results have been uploaded for this class and academic session yet.</p>
          </div>
        )}

        {/* ═════ PRINTABLE REPORT CARDS CONTAINER ═════ */}
        <div id="rc-bulk-container" className="rc-bulk-container">
          {visibleReportCards.map((rc, idx) => (
            <div key={rc.student.id} className="rc-bulk-page-wrap">
              <ReportCardDocument
                data={rc}
                settings={settings}
                session={session}
                term={term}
                isBulk={true}
                cardId={`rc-bulk-card-${idx}`}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ───────────── Screen & Bulk Layout Styles ───────────── */
const BULK_PAGE_CSS = `
.rc-bulk-root {
  min-height: 100vh;
  background: #E8ECF3;
  padding: 24px 20px 60px;
  font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif;
  color: #0F172A;
}

.rc-bulk-toolbar {
  max-width: 960px;
  margin: 0 auto 20px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
  border: 1px solid #CBD5E1;
}

.rc-bulk-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748B;
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 6px;
}
.rc-bulk-back:hover { color: #0F172A; }

.rc-bulk-title {
  font-family: 'Fraunces', serif;
  font-size: 24px;
  font-weight: 800;
  margin: 0;
  color: #0E244E;
}

.rc-bulk-desc {
  font-size: 13px;
  color: #64748B;
  margin: 4px 0 16px;
}

.rc-bulk-filters {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.rc-bulk-filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 160px;
}

.rc-bulk-filter-item label, .rc-bulk-action-item label {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rc-bulk-sel {
  background: #F8FAFC;
  border: 1px solid #CBD5E1;
  color: #0F172A;
  padding: 9px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
}

.rc-bulk-pbtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #0E244E;
  color: #fff;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.rc-bulk-pbtn:hover { background: #1A3870; }
.rc-bulk-pbtn:disabled { opacity: 0.45; cursor: not-allowed; }

/* Checklist panel */
.rc-checklist-panel {
  max-width: 960px;
  margin: 0 auto 24px;
  background: #fff;
  border-radius: 10px;
  padding: 16px 20px;
  border: 1px solid #CBD5E1;
}

.rc-checklist-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid #E2E8F0;
  padding-bottom: 8px;
}

.rc-checklist-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 700;
  color: #0E244E;
}

.rc-checklist-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11.5px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.rc-checklist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}

.rc-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #E2E8F0;
  background: #F8FAFC;
  cursor: pointer;
  user-select: none;
}
.rc-check-item.active {
  background: #EFF6FF;
  border-color: #93C5FD;
}
.rc-check-text {
  display: flex;
  flex-direction: column;
}
.rc-check-name {
  font-size: 12px;
  font-weight: 600;
  color: #0F172A;
}
.rc-check-meta {
  font-size: 10px;
  color: #64748B;
}

/* Bulk report cards preview container */
.rc-bulk-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.rc-bulk-page-wrap {
  position: relative;
}

.rc-bulk-state {
  max-width: 960px;
  margin: 32px auto;
  text-align: center;
  padding: 48px 24px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #CBD5E1;
  color: #64748B;
}
.rc-bulk-state strong { display: block; font-size: 16px; color: #0F172A; margin-bottom: 6px; }
.rc-bulk-spin {
  width: 32px;
  height: 32px;
  border: 3px solid #CBD5E1;
  border-top-color: #0E244E;
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: rcspin .8s linear infinite;
}
@keyframes rcspin { to { transform: rotate(360deg) } }
`;

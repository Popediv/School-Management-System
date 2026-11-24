import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { User, Printer, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

/* ───────────── Config (single source of truth) ───────────── */
const TERMS = [
  { value: 'FIRST',  label: 'First Term'  },
  { value: 'SECOND', label: 'Second Term' },
  { value: 'THIRD',  label: 'Third Term'  },
];

const GRADES = [
  { g: 'A', min: 75, range: '75–100', label: 'Excellent', fg: '#166534', bg: '#dcfce7', remark: 'Excellent'  },
  { g: 'B', min: 65, range: '65–74',  label: 'Very good', fg: '#1d4ed8', bg: '#dbeafe', remark: 'Very good'  },
  { g: 'C', min: 55, range: '55–64',  label: 'Good',      fg: '#92400e', bg: '#fef3c7', remark: 'Good'       },
  { g: 'D', min: 45, range: '45–54',  label: 'Pass',      fg: '#c2410c', bg: '#ffedd5', remark: 'Pass'       },
  { g: 'E', min: 40, range: '40–44',  label: 'Poor',      fg: '#7e22ce', bg: '#f3e8ff', remark: 'Needs work' },
  { g: 'F', min: 0,  range: '0–39',   label: 'Fail',      fg: '#b91c1c', bg: '#fee2e2', remark: 'Fail'       },
];
const gradeInfo = (g) => GRADES.find((x) => x.g === g) || { fg: '#374151', bg: '#f3f4f6' };
const gradeFor  = (score) =>
  score == null || isNaN(score) ? null : GRADES.find((x) => score >= x.min) || GRADES[GRADES.length - 1];

const REMARKS = [
  [75, 'An outstanding performance. This student demonstrates excellent mastery across all subjects. Keep it up!'],
  [65, 'A very commendable result. With focused effort and dedication, even greater heights are within reach.'],
  [55, 'A satisfactory performance. Dedicating more study time to weaker subjects will bring steady improvement.'],
  [45, 'A fair result. Greater diligence and consistent study habits are strongly encouraged going forward.'],
  [40, 'Performance is below expectation. Parents and guardians are advised to provide closer academic support at home.'],
  [0,  'An unsatisfactory performance. Urgent improvement is required. Significant effort must be dedicated next term.'],
];
const autoRemark = (avg) => (avg ? REMARKS.find(([min]) => avg >= min)[1] : '');

const PSYCHOMOTOR_TRAITS = [
  'Attentiveness',
  'Handwriting',
  'Honesty',
  'Neatness',
  'Politeness',
  'Punctuality',
  'Speech Fluency',
  'Sports & Games',
];

const ordinal = (n) => {
  const num = Number(n);
  if (!Number.isInteger(num)) return n ?? '—';
  const v = num % 100, s = ['th', 'st', 'nd', 'rd'];
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

const currentSession = () => {
  const now = new Date(), m = now.getMonth() + 1;
  const y = m >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    session: `${y}/${y + 1}`,
    term: m >= 9 ? 'FIRST' : m >= 5 ? 'THIRD' : 'SECOND',
    options: [`${y - 1}/${y}`, `${y}/${y + 1}`, `${y + 1}/${y + 2}`],
  };
};

/* ───────────── School Crest Fallback ───────────── */
function SchoolCrest({ size = 52, accent = '#E3B84E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <circle cx="40" cy="40" r="37" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.5)" strokeWidth="2" />
      <rect x="22" y="28" width="36" height="24" rx="3" fill="rgba(255,255,255,.92)" />
      <rect x="22" y="28" width="18" height="24" rx="2" fill={accent} />
      <line x1="40" y1="28" x2="40" y2="52" stroke="white" strokeWidth="2" />
      <rect x="37" y="14" width="6" height="16" rx="2" fill={accent} />
      <ellipse cx="40" cy="12" rx="6" ry="7" fill={accent} />
      <text x="40" y="70" textAnchor="middle" fontSize="7" fontWeight="800" fill="white" fontFamily="Georgia,serif" letterSpacing="1">PATIMO</text>
    </svg>
  );
}

const Section = ({ title, children, className = '' }) => (
  <section className={`rc-sec ${className}`}>
    <h2 className="rc-sh">{title}</h2>
    {children}
  </section>
);

/* ───────────── Main Page ───────────── */
export default function ReportCardPage() {
  const { studentId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const studentId = paramId || searchParams.get('studentId') || '';

  const def = useMemo(currentSession, []);
  const [session, setSession] = useState(def.session);
  const [term, setTerm] = useState(def.term);
  const [localPsychomotor, setLocalPsychomotor] = useState({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report-card', studentId || 'me', session, term],
    queryFn: () =>
      api.get(`/results/report-card/${studentId || 'me'}`, { params: { session, term } }).then((r) => r.data),
    enabled: isStudent ? true : !!studentId,
  });

  // Pull school settings (contains official logoUrl and name)
  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then((r) => r.data),
    placeholderData: { logoUrl: null },
    staleTime: Infinity,
  });

  const { student, results = [], summary = {}, psychomotor: savedPsychomotor } = data || {};

  /* Derived statistics - All totals are strictly whole numbers */
  const stats = useMemo(() => {
    const scored = results.filter((r) => typeof r.total === 'number');
    const total = Math.round(scored.reduce((s, r) => s + Math.round(r.total), 0));
    const avg = parseFloat(summary.average) || (scored.length ? total / scored.length : 0);
    const best  = scored.reduce((a, r) => (!a || Math.round(r.total) > Math.round(a.total) ? r : a), null);
    const worst = scored.reduce((a, r) => (!a || Math.round(r.total) < Math.round(a.total) ? r : a), null);
    const failed = scored.filter((r) => Math.round(r.total) < 40).length;
    return { total, avg, best, worst, failed, count: results.length };
  }, [results, summary.average]);

  const og = gradeFor(stats.avg);
  const termLabel = TERMS.find((t) => t.value === term)?.label || term;
  const now = new Date();
  const subjectName = (r) => r.subject?.name || r.subject || '—';
  const hasClassAvg = results.some((r) => r.classAverage != null);

  // Exact school details aligned with Admission Letter
  const sch = {
    name: 'PATIMO SCHOOLS INTERNATIONAL',
    motto: 'From Grace to Glory',
    addr: 'Plot 13&14, Maito Bakery Street, Adesola, Ibadan',
    phone: 'Proprietor: 08034556007 · Principal: 08034877814 · General Manager: 08138070528',
    email: 'info@patimocollege.edu.ng',
    logo: settings?.logoUrl || '/psilogo.JPG',
  };

  const fullName = student
    ? [student.firstName, student.otherNames, student.lastName].filter(Boolean).join(' ')
    : '';

  // Determine Junior vs Senior Secondary School
  const className = student?.currentClass?.name?.toUpperCase() || '';
  const classLevel = student?.currentClass?.level?.toUpperCase() || '';
  const isSenior = classLevel === 'SSS' || classLevel === 'SS' || className.startsWith('SS');

  // Resolve Student's Passport Photograph URL
  const photoSrc = student?.photo
    ? (student.photo.startsWith('http') || student.photo.startsWith('data:')
        ? student.photo
        : (student.photo.startsWith('/uploads/')
            ? student.photo
            : (student.photo.startsWith('/') ? student.photo : `/uploads/${student.photo}`)))
    : (student?.photoUrl || null);

  // Get psychomotor rating (Priority: 1. Teacher saved in DB, 2. On-screen edit, 3. Realistic default)
  const getRating = (trait) => {
    if (savedPsychomotor && savedPsychomotor[trait] !== undefined) {
      return Number(savedPsychomotor[trait]);
    }
    if (localPsychomotor[trait] !== undefined) {
      return Number(localPsychomotor[trait]);
    }
    const hash = (student?.admissionNo || student?.id || 'A')
      .split('')
      .reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
    const traitIdx = PSYCHOMOTOR_TRAITS.indexOf(trait);
    return ((hash + traitIdx * 3) % 2) + 4; // produces 4 or 5
  };

  const handleRate = (trait, rating) => {
    setLocalPsychomotor(prev => ({ ...prev, [trait]: rating }));
  };

  /* Bulletproof print function using isolated iframe */
  const handlePrint = () => {
    const card = document.getElementById('rc-card');
    if (!card) {
      window.print();
      return;
    }

    const oldFrame = document.getElementById('rc-print-frame');
    if (oldFrame) oldFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = 'rc-print-frame';
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
  <title>Report Card - ${fullName} - ${termLabel} ${session}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap" rel="stylesheet">
  <style>
    ${PRINT_CORE_CSS}
  </style>
</head>
<body>
  ${card.outerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => {
        try { frame.remove(); } catch (_) {}
      }, 2500);
    }, 450);
  };

  return (
    <>
      <style>{SCREEN_AND_PAGE_CSS}</style>
      <div className="rc-root">
        {/* Toolbar */}
        <div className="rc-toolbar">
          <div className="rc-tb-left">
            {!isStudent && (
              <Link to={studentId ? `/students/${studentId}` : '/students'} className="rc-back">
                <ArrowLeft size={15} />
                Back to student
              </Link>
            )}
            <h1 className="rc-title">Student Report Card</h1>
            <p className="rc-subtitle">
              {student ? `${fullName} · ${termLabel}, ${session}` : 'Choose a session and term'}
            </p>
          </div>
          <div className="rc-controls">
            <select className="rc-sel" aria-label="Session" value={session} onChange={(e) => setSession(e.target.value)}>
              {def.options.map((s) => <option key={s} value={s}>{s} session</option>)}
            </select>
            <select className="rc-sel" aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)}>
              {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="rc-pbtn" onClick={handlePrint} disabled={!data || isLoading}>
              <Printer size={16} />
              Print / Save PDF (A4)
            </button>
          </div>
        </div>

        {/* Status / Notice */}
        {isLoading && (
          <div className="rc-state" role="status">
            <div className="rc-spin" />
            <p>Loading report card…</p>
          </div>
        )}
        {isError && (
          <div className="rc-state rc-state-err" role="alert">
            <strong>Notice</strong>
            <p>{error?.response?.data?.message || 'No results uploaded for this term and session yet.'}</p>
          </div>
        )}
        {!isStudent && !studentId && !isLoading && (
          <div className="rc-state rc-state-empty">
            <strong>No student selected</strong>
            <p>Open this page from a student profile, or append <code>?studentId=ID</code> to the URL.</p>
          </div>
        )}

        {/* ═════ REPORT CARD (A4 PORTRAIT) ═════ */}
        {data && student && (
          <article
            id="rc-card"
            className={isSenior ? 'theme-senior' : 'theme-junior'}
            aria-label={`Report card for ${fullName}`}
          >
            {/* Watermark Logo */}
            <div
              className="rc-watermark"
              style={{ backgroundImage: `url(${sch.logo || '/psilogo.JPG'})` }}
              aria-hidden="true"
            />

            {/* Header */}
            <header className="rc-header">
              <div className="rc-header-inner">
                <div className="rc-logo-ring">
                  <img
                    src={sch.logo || '/psilogo.JPG'}
                    alt="School Logo"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/psilogo.JPG';
                    }}
                  />
                </div>
                <div className="rc-school-block">
                  <h2 className="rc-school-name">{sch.name}</h2>
                  <p className="rc-school-motto">“{sch.motto}”</p>
                  <p className="rc-school-meta">
                    {sch.addr} &nbsp;·&nbsp; ✉ {sch.email}<br />
                    {sch.phone}
                  </p>
                </div>
                <div className="rc-badge">
                  <div className="rc-badge-eyebrow">
                    {isSenior ? 'Senior Secondary (SSS)' : 'Junior Secondary (JSS)'}
                  </div>
                  <div className="rc-badge-term">{termLabel}</div>
                  <div className="rc-badge-session">{session} Session</div>
                </div>
              </div>
              <div className="rc-ribbon" />
            </header>

            <div className="rc-body">
              {/* Student Identification Bar with Passport Photograph */}
              <div className="rc-id">
                {/* Official Passport Box */}
                <div className="rc-passport-box">
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt={fullName}
                      className="rc-passport-img"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const p = e.currentTarget.parentElement?.querySelector('.rc-passport-placeholder');
                        if (p) p.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="rc-passport-placeholder"
                    style={{ display: photoSrc ? 'none' : 'flex' }}
                  >
                    <User size={26} style={{ color: 'var(--mute)' }} />
                    <span className="rc-passport-lbl">PASSPORT</span>
                  </div>
                </div>

                <div className="rc-id-main">
                  <div className="rc-id-name">{fullName}</div>
                  <div className="rc-id-sub">
                    <b>Class:</b> {student.currentClass?.name || '—'}
                    {student.admissionNo ? ` · Adm No: ${student.admissionNo}` : ''}
                  </div>
                  <div className="rc-id-meta-row">
                    <span><b>Gender:</b> {student.gender ? student.gender[0].toUpperCase() + student.gender.slice(1).toLowerCase() : '—'}</span>
                    <span><b>DOB:</b> {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : '—'}</span>
                    <span><b>Date Printed:</b> {now.toLocaleDateString('en-GB')}</span>
                  </div>
                </div>

                {summary.position && (
                  <div className="rc-id-pos">
                    <div className="rc-id-pos-n">{ordinal(summary.position)}</div>
                    <div className="rc-id-pos-l">
                      {summary.classSize ? `of ${summary.classSize} in Class` : 'Position in Class'}
                    </div>
                  </div>
                )}
              </div>

              {/* Academic Performance Table */}
              <Section title="Academic Performance">
                {results.length > 0 ? (
                  <div className="rc-table-wrap">
                    <table className="rc-table">
                      <thead>
                        <tr>
                          <th style={{ width: 28, textAlign: 'center' }}>#</th>
                          <th>Subject</th>
                          <th className="c">CA <span>/30</span></th>
                          <th className="c">Exam <span>/70</span></th>
                          <th className="c rc-th-total">Total <span>/100</span></th>
                          {hasClassAvg && <th className="c">Class Avg</th>}
                          <th className="c">Grade</th>
                          <th className="c">Pos.</th>
                          <th>Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => {
                          const gi = gradeFor(r.total);
                          const letter = gi?.g || r.grade || '—';
                          const col = gradeInfo(letter);
                          const displayRemark = gi?.remark || r.remark || '—';
                          return (
                            <tr key={r.id || i} className={r.total < 40 ? 'rc-fail' : ''}>
                              <td className="rc-muted" style={{ textAlign: 'center' }}>{i + 1}</td>
                              <td className="rc-sn">{subjectName(r)}</td>
                              <td className="c">{r.caScore ?? r.ca ?? '—'}</td>
                              <td className="c">{r.examScore ?? r.exam ?? '—'}</td>
                              <td className="rc-tot-cell">
                                <span className="rc-total" style={{ color: col.fg }}>{r.total != null ? Math.round(r.total) : '—'}</span>
                                <span className="rc-bar"><i style={{ width: `${Math.min(Math.round(r.total || 0), 100)}%`, background: col.fg }} /></span>
                              </td>
                              {hasClassAvg && <td className="c rc-muted">{r.classAverage ?? '—'}</td>}
                              <td className="c">
                                <span className="rc-gpill" style={{ background: col.bg, color: col.fg }}>{letter}</span>
                              </td>
                              <td className="c rc-muted">{r.position != null ? ordinal(r.position) : '—'}</td>
                              <td className="rc-muted">{displayRemark}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rc-none">No results recorded for {termLabel}, {session}.</div>
                )}
              </Section>

              {/* Lower 2-Column Section */}
              <div className="rc-lower-grid">
                {/* Left Column: Psychomotor Assessment & Grading Scale */}
                <div className="rc-lower-col">
                  <Section title="Psychomotor & Behavioural Assessment">
                    <div className="rc-psycho-table-wrap">
                      <table className="rc-psycho-table">
                        <thead>
                          <tr>
                            <th className="rc-psycho-th-trait">Behavioural Trait</th>
                            {[1, 2, 3, 4, 5].map(num => (
                              <th key={num} className="c rc-psycho-th-num">{num}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PSYCHOMOTOR_TRAITS.map(trait => {
                            const current = getRating(trait);
                            return (
                              <tr key={trait}>
                                <td className="rc-psycho-trait">{trait}</td>
                                {[1, 2, 3, 4, 5].map(num => (
                                  <td
                                    key={num}
                                    className={`c rc-psycho-cell ${current === num ? 'active' : ''}`}
                                    onClick={() => handleRate(trait, num)}
                                    title={`Rating ${num} for ${trait}`}
                                  >
                                    {current === num ? '✓' : ''}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="rc-psycho-key">
                        Scale: 5-Excellent &nbsp;|&nbsp; 4-Very Good &nbsp;|&nbsp; 3-Good &nbsp;|&nbsp; 2-Fair &nbsp;|&nbsp; 1-Poor
                      </div>
                    </div>
                  </Section>

                  <Section title="Grading Scale">
                    <div className="rc-gkey">
                      {GRADES.map((x) => (
                        <div key={x.g} className="rc-gki">
                          <div className="rc-gki-letter" style={{ color: x.fg }}>{x.g}</div>
                          <div className="rc-gki-range">{x.range}</div>
                          <div className="rc-gki-label">{x.label}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                </div>

                {/* Right Column: Performance Summary, Remarks, Next Term */}
                <div className="rc-lower-col">
                  <Section title="Performance Summary">
                    <div className="rc-sumgrid">
                      {[
                        ['Subjects', stats.count, 'var(--primary-theme)'],
                        ['Total Score', stats.total, 'var(--primary-theme)'],
                        ['Average', stats.avg ? stats.avg.toFixed(1) : '—', '#B45309'],
                        ['Overall Grade', og?.g || '—', og?.fg || '#374151'],
                      ].map(([l, v, c]) => (
                        <div key={l} className="rc-sumcard">
                          <div className="rc-suml">{l}</div>
                          <div className="rc-sumv" style={{ color: c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {stats.best && stats.count > 1 && (
                      <p className="rc-insight">
                        <b>Strongest:</b> {subjectName(stats.best)} ({stats.best.total}) &nbsp;·&nbsp;
                        <b>Needs Attention:</b> {subjectName(stats.worst)} ({stats.worst.total})
                        {stats.failed > 0 && <> &nbsp;·&nbsp; Below pass mark in <b>{stats.failed}</b></>}
                      </p>
                    )}
                  </Section>

                  <Section title="Remarks">
                    <div className="rc-rbox">
                      <div className="rc-rlabel">Class Teacher’s Comment</div>
                      <div className="rc-rtext">{summary.teacherRemark || autoRemark(stats.avg)}</div>
                    </div>
                    <div className="rc-rbox">
                      <div className="rc-rlabel">Principal’s Comment</div>
                      <div className="rc-rtext">{summary.principalRemark || 'A commendable academic performance. Keep striving for greater heights.'}</div>
                    </div>
                  </Section>

                  <Section title="Next Term">
                    <div className="rc-nextgrid">
                      <div className="rc-nextcard">
                        <div className="rc-nextl">Resumption Date</div>
                        <div className="rc-nextv">{summary.nextTermDate || '—'}</div>
                      </div>
                      <div className="rc-nextcard">
                        <div className="rc-nextl">School Fees</div>
                        <div className="rc-nextv">{summary.nextTermFee ? `₦${Number(summary.nextTermFee).toLocaleString('en-NG')}` : '—'}</div>
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              {/* Signatures */}
              <div className="rc-signgrid">
                {['Class Teacher', 'Vice Principal (Academics)', 'Principal'].map((t) => (
                  <div key={t} className="rc-signbox">
                    <div className="rc-signgap" />
                    <div className="rc-signline" />
                    <div className="rc-signtitle">{t}</div>
                    <div className="rc-signrole">Signature & Date</div>
                  </div>
                ))}
              </div>

              {/* Official Document Footer */}
              <footer className="rc-footer">
                <span>Printed: {now.toLocaleDateString('en-GB')}</span>
                <span className="rc-footer-stamp">
                  Official Academic Document · {sch.name} {isSenior ? '(Senior Section)' : '(Junior Section)'}
                </span>
                <span>{session} · {termLabel}</span>
              </footer>
            </div>
          </article>
        )}
      </div>
    </>
  );
}

/* ───────────── Print Core CSS (Fills A4 Gracefully) ───────────── */
const PRINT_CORE_CSS = `
@page {
  size: A4 portrait;
  margin: 6mm 8mm !important;
}
* {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  box-sizing: border-box !important;
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #fff !important;
  font-family: 'Source Sans 3', system-ui, -apple-system, sans-serif !important;
  color: #0F172A !important;
  font-size: 11px !important;
  height: 100% !important;
  overflow: hidden !important;
}

/* Theme variables */
#rc-card.theme-junior {
  --primary-theme: #0E244E;
  --secondary-theme: #1A3870;
  --accent-gold: #E3B84E;
  --header-bg: linear-gradient(125deg, #0A1B3B 0%, #153268 50%, #1C448E 100%);
  --ribbon-bg: linear-gradient(90deg, #C9952A, #F0C85A 30%, #C9952A 50%, #F0C85A 70%, #C9952A);
  --border-theme: #CBD5E1;
}

#rc-card.theme-senior {
  --primary-theme: #500714;
  --secondary-theme: #7A1B28;
  --accent-gold: #F0C85A;
  --header-bg: linear-gradient(125deg, #3B0A11 0%, #5E131E 50%, #831B2A 100%);
  --ribbon-bg: linear-gradient(90deg, #831B2A, #D4AF37 30%, #831B2A 50%, #F0C85A 70%, #831B2A);
  --border-theme: #D9C3C6;
}

#rc-card {
  box-sizing: border-box !important;
  width: 100% !important;
  height: 283mm !important;
  max-height: 283mm !important;
  min-height: 283mm !important;
  margin: 0 auto !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  border: 1.5px solid var(--border-theme) !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  page-break-after: avoid !important;
  break-after: avoid !important;
  page-break-before: avoid !important;
  break-before: avoid !important;
  background: #fff !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  overflow: hidden !important;
}

.rc-watermark {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) rotate(-10deg) !important;
  width: 320px !important;
  height: 320px !important;
  background-size: contain !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  opacity: 0.045 !important;
  pointer-events: none !important;
  z-index: 0 !important;
}

.rc-header {
  background: var(--header-bg) !important;
  position: relative !important;
  z-index: 1 !important;
}
.rc-header-inner {
  padding: 12px 18px 10px !important;
  display: flex !important;
  align-items: center !important;
  gap: 16px !important;
}
.rc-logo-ring {
  width: 60px !important;
  height: 60px !important;
  border-radius: 8px !important;
  border: 2px solid var(--accent-gold) !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: #fff !important;
  padding: 2px !important;
  flex-shrink: 0 !important;
}
.rc-logo-ring img { width: 100% !important; height: 100% !important; object-fit: contain !important; background: #fff !important; }
.rc-school-block { flex: 1 !important; min-width: 0 !important; }
.rc-school-name {
  font-family: 'Fraunces', serif !important;
  font-size: 20px !important;
  font-weight: 800 !important;
  color: #fff !important;
  line-height: 1.1 !important;
  margin: 0 0 2px !important;
  letter-spacing: 0.5px !important;
}
.rc-school-motto {
  font-style: italic !important;
  color: var(--accent-gold) !important;
  font-size: 10.5px !important;
  font-weight: 600 !important;
  margin: 0 0 3px !important;
}
.rc-school-meta {
  font-size: 9.5px !important;
  color: rgba(255, 255, 255, .85) !important;
  line-height: 1.35 !important;
  margin: 0 !important;
}
.rc-badge {
  flex-shrink: 0 !important;
  border: 1px solid var(--accent-gold) !important;
  border-radius: 8px !important;
  padding: 8px 14px !important;
  text-align: center !important;
  min-width: 120px !important;
  background: rgba(255, 255, 255, .1) !important;
}
.rc-badge-eyebrow { font-size: 8.5px !important; color: rgba(255, 255, 255, .8) !important; text-transform: uppercase !important; font-weight: 700 !important; }
.rc-badge-term { font-family: 'Fraunces', serif !important; font-size: 15px !important; font-weight: 800 !important; color: #fff !important; line-height: 1.15 !important; }
.rc-badge-session { font-size: 10.5px !important; color: var(--accent-gold) !important; font-weight: 700 !important; margin-top: 2px !important; }
.rc-ribbon {
  height: 4px !important;
  background: var(--ribbon-bg) !important;
}
.rc-body {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  padding: 8px 18px 6px !important;
  position: relative !important;
  z-index: 1 !important;
  min-height: 0 !important;
}

/* Student ID with Passport */
.rc-id {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  padding: 8px 12px !important;
  border: 1px solid #CBD5E1 !important;
  border-left: 4px solid var(--primary-theme) !important;
  border-radius: 8px !important;
  background: #FBFCFE !important;
}
.rc-passport-box {
  width: 58px !important;
  height: 68px !important;
  border-radius: 4px !important;
  border: 1.5px solid #94A3B8 !important;
  overflow: hidden !important;
  background: #F1F5F9 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
}
.rc-passport-img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
.rc-passport-placeholder { display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; }
.rc-passport-lbl { font-size: 7px !important; color: #94A3B8 !important; font-weight: 700 !important; margin-top: 2px !important; }
.rc-id-main { flex: 1 !important; min-width: 0 !important; }
.rc-id-name { font-family: 'Fraunces', serif !important; font-size: 16px !important; font-weight: 800 !important; line-height: 1.15 !important; color: #0F172A !important; }
.rc-id-sub { font-size: 11px !important; color: #475569 !important; margin-top: 2px !important; }
.rc-id-meta-row { display: flex !important; gap: 16px !important; font-size: 9.5px !important; color: #334155 !important; margin-top: 4px !important; }
.rc-id-pos { text-align: right !important; padding-left: 14px !important; border-left: 1px solid #CBD5E1 !important; }
.rc-id-pos-n { font-family: 'Fraunces', serif !important; font-size: 22px !important; font-weight: 800 !important; color: var(--primary-theme) !important; line-height: 1 !important; }
.rc-id-pos-l { font-size: 9px !important; color: #64748B !important; margin-top: 2px !important; }

/* Section Heading */
.rc-sec { margin-top: 10px !important; }
.rc-sh {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: 'Fraunces', serif !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  color: var(--primary-theme) !important;
  margin: 0 0 5px !important;
}
.rc-sh::after { content: '' !important; flex: 1 !important; height: 1px !important; background: #CBD5E1 !important; }

/* Academic Table */
.rc-table-wrap { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; }
.rc-table { width: 100% !important; border-collapse: collapse !important; font-size: 10.5px !important; }
.rc-table thead tr { background: var(--primary-theme) !important; }
.rc-table th { padding: 6px 8px !important; font-size: 9.5px !important; color: rgba(255, 255, 255, .95) !important; font-weight: 700 !important; text-align: left !important; }
.rc-table th span { opacity: .75 !important; font-weight: 400 !important; font-size: 8px !important; }
.rc-table .c { text-align: center !important; }
.rc-table td { padding: 5px 8px !important; border-bottom: 1px solid #E2E8F0 !important; vertical-align: middle !important; }
.rc-table tbody tr:nth-child(even) { background: #F8FAFC !important; }
.rc-sn { font-weight: 600 !important; font-size: 11px !important; color: #0F172A !important; }
.rc-muted { color: #64748B !important; font-size: 10px !important; }
.rc-tot-cell { min-width: 80px !important; }
.rc-total { font-weight: 800 !important; font-size: 12px !important; display: inline-block !important; width: 24px !important; }
.rc-bar { display: inline-block !important; vertical-align: middle !important; width: 38px !important; height: 5px !important; border-radius: 2px !important; background: #E2E8F0 !important; margin-left: 4px !important; overflow: hidden !important; }
.rc-bar i { display: block !important; height: 100% !important; border-radius: 2px !important; }
.rc-gpill { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 19px !important; height: 19px !important; border-radius: 50% !important; font-weight: 800 !important; font-size: 9.5px !important; }

/* Lower 2 Columns */
.rc-lower-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 12px !important;
  margin-top: 10px !important;
}
.rc-lower-col { display: flex !important; flex-direction: column !important; gap: 8px !important; }

/* Psychomotor */
.rc-psycho-table-wrap { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-psycho-table { width: 100% !important; border-collapse: collapse !important; font-size: 9.5px !important; }
.rc-psycho-table thead tr { background: #F1F5F9 !important; border-bottom: 1px solid #CBD5E1 !important; }
.rc-psycho-th-trait { padding: 4.5px 8px !important; font-weight: 700 !important; text-align: left !important; color: var(--primary-theme) !important; }
.rc-psycho-th-num { width: 22px !important; padding: 4.5px 0 !important; font-weight: 800 !important; color: var(--primary-theme) !important; border-left: 1px solid #CBD5E1 !important; text-align: center !important; }
.rc-psycho-table td { padding: 3.5px 8px !important; border-bottom: 1px solid #E2E8F0 !important; }
.rc-psycho-trait { font-weight: 500 !important; color: #334155 !important; }
.rc-psycho-cell { border-left: 1px solid #CBD5E1 !important; font-weight: 800 !important; color: #166534 !important; text-align: center !important; font-size: 11px !important; }
.rc-psycho-cell.active { background: #F0FDF4 !important; }
.rc-psycho-key { padding: 3px 8px !important; background: #F8FAFC !important; border-top: 1px solid #CBD5E1 !important; font-size: 8px !important; color: #64748B !important; text-align: center !important; font-weight: 600 !important; }

/* Grading Scale */
.rc-gkey { display: grid !important; grid-template-columns: repeat(6, 1fr) !important; border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-gki { padding: 5px 3px !important; text-align: center !important; border-right: 1px solid #CBD5E1 !important; }
.rc-gki:last-child { border-right: 0 !important; }
.rc-gki-letter { font-family: 'Fraunces', serif !important; font-size: 14px !important; font-weight: 800 !important; line-height: 1 !important; }
.rc-gki-range { font-size: 8.5px !important; color: #475569 !important; font-weight: 600 !important; margin-top: 1px !important; }
.rc-gki-label { font-size: 7.5px !important; color: #64748B !important; }

/* Summary */
.rc-sumgrid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-sumcard { padding: 6px 8px !important; border-right: 1px solid #CBD5E1 !important; text-align: center !important; }
.rc-sumcard:last-child { border-right: 0 !important; }
.rc-suml { font-size: 8.5px !important; color: #64748B !important; margin-bottom: 2px !important; font-weight: 600 !important; }
.rc-sumv { font-family: 'Fraunces', serif !important; font-size: 16px !important; font-weight: 800 !important; line-height: 1 !important; }
.rc-insight { font-size: 9px !important; color: #334155 !important; margin: 4px 0 0 !important; line-height: 1.35 !important; }

/* Remarks */
.rc-rbox { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; padding: 6px 10px !important; margin-bottom: 6px !important; background: #fff !important; }
.rc-rlabel { font-size: 8.5px !important; font-weight: 700 !important; color: var(--primary-theme) !important; margin-bottom: 2px !important; }
.rc-rtext { min-height: 28px !important; font-size: 9.5px !important; color: #334155 !important; line-height: 1.35 !important; border-top: 1px dashed #E2E8F0 !important; padding-top: 3px !important; }

/* Next Term */
.rc-nextgrid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
.rc-nextcard { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; padding: 6px 10px !important; background: #fff !important; }
.rc-nextl { font-size: 8px !important; color: #64748B !important; margin-bottom: 1px !important; font-weight: 600 !important; }
.rc-nextv { font-size: 11px !important; font-weight: 700 !important; color: #0F172A !important; }

/* Signatures */
.rc-signgrid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 24px !important; margin-top: 14px !important; }
.rc-signbox { text-align: center !important; }
.rc-signgap { height: 34px !important; }
.rc-signline { border-top: 1.5px solid var(--primary-theme) !important; margin-bottom: 3px !important; }
.rc-signtitle { font-size: 10px !important; font-weight: 700 !important; color: #0F172A !important; }
.rc-signrole { font-size: 8.5px !important; color: #64748B !important; }

/* Footer */
.rc-footer { margin-top: 10px !important; padding-top: 6px !important; border-top: 1px solid #CBD5E1 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 8px !important; color: #94A3B8 !important; }
.rc-footer-stamp { background: var(--primary-theme) !important; color: rgba(255, 255, 255, .9) !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 8px !important; font-weight: 600 !important; }
`;

/* ───────────── Screen & Interactive CSS ───────────── */
const SCREEN_AND_PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap');

.rc-root {
  --navy: #0E244E;
  --navy2: #1A3870;
  --gold: #E3B84E;
  --ink: #0F172A;
  --mute: #64748B;
  --line: #E2E8F0;
  font-family: 'Source Sans 3', system-ui, sans-serif;
  background: #E8ECF3;
  min-height: 100vh;
  padding: 24px 16px 48px;
  color: var(--ink);
}
.rc-root * { box-sizing: border-box; }

/* Themes */
#rc-card.theme-junior {
  --primary-theme: #0E244E;
  --secondary-theme: #1A3870;
  --accent-gold: #E3B84E;
  --header-bg: linear-gradient(125deg, #0A1B3B 0%, #153268 50%, #1C448E 100%);
  --ribbon-bg: linear-gradient(90deg, #C9952A, #F0C85A 30%, #C9952A 50%, #F0C85A 70%, #C9952A);
  --border-theme: #CBD5E1;
}

#rc-card.theme-senior {
  --primary-theme: #4A0E17;
  --secondary-theme: #7A1B28;
  --accent-gold: #F0C85A;
  --header-bg: linear-gradient(125deg, #3B0A11 0%, #5E131E 50%, #831B2A 100%);
  --ribbon-bg: linear-gradient(90deg, #831B2A, #D4AF37 30%, #831B2A 50%, #F0C85A 70%, #831B2A);
  --border-theme: #E2D3D5;
}

/* Toolbar */
.rc-toolbar {
  max-width: 900px;
  margin: 0 auto 20px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}
.rc-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--mute);
  text-decoration: none;
  font-size: 13px;
  margin-bottom: 8px;
}
.rc-back:hover { color: var(--ink); }
.rc-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 700; margin: 0; }
.rc-subtitle { font-size: 13.5px; color: var(--mute); margin: 2px 0 0; }
.rc-controls { display: flex; gap: 8px; flex-wrap: wrap; }
.rc-sel {
  background: #fff;
  border: 1px solid #CBD5E1;
  color: var(--ink);
  padding: 9px 32px 9px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.rc-pbtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  background: var(--navy);
  color: #fff;
  border: 0;
  border-radius: 8px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.rc-pbtn:hover { background: var(--navy2); }
.rc-pbtn:disabled { opacity: .45; cursor: not-allowed; }

/* States */
.rc-state {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
  padding: 56px 24px;
  border-radius: 12px;
  background: #fff;
  color: var(--mute);
  font-size: 14px;
}
.rc-state strong { display: block; font-size: 16px; color: var(--ink); margin-bottom: 6px; }
.rc-state p { margin: 0; }
.rc-state-err { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }
.rc-state-err strong { color: #991B1B; }
.rc-state-empty { border: 2px dashed #CBD5E1; background: transparent; }
.rc-spin {
  width: 36px;
  height: 36px;
  border: 3px solid #CBD5E1;
  border-top-color: var(--navy2);
  border-radius: 50%;
  margin: 0 auto 12px;
  animation: rcspin .8s linear infinite;
}
@keyframes rcspin { to { transform: rotate(360deg) } }

/* Screen Card */
#rc-card {
  max-width: 900px;
  min-height: 1050px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin: 0 auto;
  background: #fff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(15, 23, 42, .18);
  position: relative;
  border: 1.5px solid var(--border-theme);
}

.rc-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-10deg);
  width: 380px;
  height: 380px;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.045;
  pointer-events: none;
  z-index: 0;
}

.rc-header {
  background: var(--header-bg);
  position: relative;
  z-index: 1;
}
.rc-header-inner {
  position: relative;
  padding: 22px 30px 18px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.rc-logo-ring {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  flex-shrink: 0;
  border: 3px solid var(--accent-gold);
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.rc-logo-ring img { width: 100%; height: 100%; object-fit: contain; }
.rc-school-block { flex: 1; min-width: 0; }
.rc-school-name { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 800; color: #fff; line-height: 1.1; margin: 0 0 2px; letter-spacing: 0.5px; }
.rc-school-motto { font-style: italic; color: var(--accent-gold); font-size: 13px; font-weight: 600; margin: 0 0 4px; }
.rc-school-meta { font-size: 11.5px; color: rgba(255, 255, 255, .8); line-height: 1.5; margin: 0; }
.rc-badge {
  flex-shrink: 0;
  border: 1px solid var(--accent-gold);
  border-radius: 8px;
  padding: 10px 16px;
  text-align: center;
  min-width: 140px;
  background: rgba(255, 255, 255, .1);
}
.rc-badge-eyebrow { font-size: 10px; color: rgba(255, 255, 255, .8); margin-bottom: 2px; text-transform: uppercase; font-weight: 700; }
.rc-badge-term { font-family: 'Fraunces', serif; font-size: 17px; font-weight: 800; color: #fff; line-height: 1.15; }
.rc-badge-session { font-size: 12px; color: var(--accent-gold); margin-top: 2px; font-weight: 700; }
.rc-ribbon { height: 4px; background: var(--ribbon-bg); }

.rc-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 28px 16px;
  position: relative;
  z-index: 1;
}
.rc-sec { margin-top: 18px; }
.rc-sh {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fraunces', serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--primary-theme);
  margin: 0 0 8px;
}
.rc-sh::after { content: ''; flex: 1; height: 1px; background: var(--line); }

/* Student ID with Passport */
.rc-id {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--primary-theme);
  border-radius: 8px;
  background: #FBFCFE;
}
.rc-passport-box {
  width: 66px;
  height: 78px;
  border-radius: 6px;
  border: 1.5px solid #CBD5E1;
  overflow: hidden;
  background: #F1F5F9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}
.rc-passport-img { width: 100%; height: 100%; object-fit: cover; }
.rc-passport-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.rc-passport-lbl { font-size: 8px; color: var(--mute); font-weight: 700; letter-spacing: 0.5px; }
.rc-id-main { flex: 1; min-width: 0; }
.rc-id-name { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; line-height: 1.2; color: #0F172A; }
.rc-id-sub { font-size: 13px; color: var(--mute); margin-top: 2px; }
.rc-id-meta-row { display: flex; gap: 18px; font-size: 12px; color: #475569; margin-top: 4px; flex-wrap: wrap; }
.rc-id-pos { text-align: right; padding-left: 16px; border-left: 1px solid var(--line); }
.rc-id-pos-n { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 800; color: var(--primary-theme); line-height: 1; }
.rc-id-pos-l { font-size: 11px; color: var(--mute); margin-top: 2px; }

/* Table */
.rc-table-wrap { border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }
.rc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rc-table thead tr { background: var(--primary-theme); }
.rc-table th { padding: 9px 12px; font-size: 11.5px; color: rgba(255, 255, 255, .95); font-weight: 700; text-align: left; white-space: nowrap; }
.rc-table th span { opacity: .7; font-weight: 400; font-size: 10px; }
.rc-table .c { text-align: center; }
.rc-table td { padding: 8px 12px; border-bottom: 1px solid #EEF2F7; vertical-align: middle; }
.rc-table tbody tr:nth-child(even) { background: #F8FAFC; }
.rc-table tbody tr:last-child td { border-bottom: 0; }
.rc-fail td:first-child { box-shadow: inset 3px 0 #DC2626; }
.rc-sn { font-weight: 600; font-size: 13.5px; }
.rc-muted { color: var(--mute); font-size: 12px; }
.rc-tot-cell { min-width: 95px; }
.rc-total { font-weight: 700; font-size: 14.5px; display: inline-block; width: 28px; }
.rc-bar { display: inline-block; vertical-align: middle; width: 44px; height: 5px; border-radius: 3px; background: #E8EDF4; overflow: hidden; margin-left: 4px; }
.rc-bar i { display: block; height: 100%; border-radius: 3px; }
.rc-gpill { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-weight: 700; font-size: 11.5px; }
.rc-none { text-align: center; padding: 24px; color: var(--mute); border: 2px dashed var(--line); border-radius: 8px; font-size: 13.5px; }

/* Lower Section 2-Columns */
.rc-lower-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
.rc-lower-col { display: flex; flex-direction: column; gap: 10px; }

/* Psychomotor */
.rc-psycho-table-wrap { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: #fff; }
.rc-psycho-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.rc-psycho-table thead tr { background: #F1F5F9; border-bottom: 1px solid var(--line); }
.rc-psycho-th-trait { padding: 6px 10px; font-weight: 700; text-align: left; color: var(--primary-theme); }
.rc-psycho-th-num { width: 26px; padding: 6px 0; font-weight: 800; color: var(--primary-theme); border-left: 1px solid var(--line); text-align: center; }
.rc-psycho-table td { padding: 5px 10px; border-bottom: 1px solid #EEF2F7; }
.rc-psycho-table tbody tr:last-child td { border-bottom: 0; }
.rc-psycho-trait { font-weight: 500; color: #334155; }
.rc-psycho-cell { border-left: 1px solid var(--line); font-weight: 800; color: #166534; cursor: pointer; user-select: none; text-align: center; }
.rc-psycho-cell.active { background: #F0FDF4; }
.rc-psycho-key { padding: 4px 10px; background: #F8FAFC; border-top: 1px solid var(--line); font-size: 10px; color: var(--mute); text-align: center; font-weight: 600; }

/* Grading key */
.rc-gkey { display: grid; grid-template-columns: repeat(6, 1fr); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.rc-gki { padding: 6px 4px; text-align: center; border-right: 1px solid var(--line); background: #fff; }
.rc-gki:last-child { border-right: 0; }
.rc-gki-letter { font-family: 'Fraunces', serif; font-size: 16px; font-weight: 800; line-height: 1; }
.rc-gki-range { font-size: 11px; color: #475569; font-weight: 600; margin-top: 2px; }
.rc-gki-label { font-size: 10px; color: var(--mute); }

/* Summary */
.rc-sumgrid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.rc-sumcard { padding: 8px 10px; border-right: 1px solid var(--line); background: #fff; text-align: center; }
.rc-sumcard:last-child { border-right: 0; }
.rc-suml { font-size: 11px; color: var(--mute); margin-bottom: 2px; font-weight: 600; }
.rc-sumv { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; line-height: 1.1; }
.rc-insight { margin: 6px 2px 0; font-size: 12px; color: #334155; line-height: 1.5; }

/* Remarks */
.rc-rbox { border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; background: #fff; }
.rc-rlabel { font-size: 11px; font-weight: 700; color: var(--primary-theme); margin-bottom: 2px; }
.rc-rtext { min-height: 32px; font-size: 12.5px; color: #334155; line-height: 1.45; border-top: 1px dashed var(--line); padding-top: 4px; }

/* Next term */
.rc-nextgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rc-nextcard { border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; background: #fff; }
.rc-nextl { font-size: 11px; color: var(--mute); margin-bottom: 2px; font-weight: 600; }
.rc-nextv { font-size: 14px; font-weight: 700; color: #0F172A; }

/* Signatures */
.rc-signgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 18px; }
.rc-signbox { text-align: center; }
.rc-signgap { height: 38px; }
.rc-signline { border-top: 1.5px solid var(--primary-theme); margin-bottom: 4px; }
.rc-signtitle { font-size: 12px; font-weight: 700; color: #0F172A; }
.rc-signrole { font-size: 11px; color: var(--mute); }
.rc-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #94A3B8; }
.rc-footer-stamp { background: var(--primary-theme); color: rgba(255, 255, 255, .9); padding: 3px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 600; }

/* ────────── NATIVE BROWSER PRINT (CTRL + P) ────────── */
@media print {
  @page {
    size: A4 portrait;
    margin: 6mm 8mm !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-sizing: border-box !important;
  }
  html, body, #root, .app-layout, .main-content, .page-content, .rc-root {
    display: block !important;
    position: static !important;
    overflow: hidden !important;
    height: 100% !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    border: none !important;
    box-shadow: none !important;
  }
  .topbar, .sidebar, #mobile-menu-btn, .rc-toolbar, nav, aside {
    display: none !important;
    visibility: hidden !important;
  }
  ${PRINT_CORE_CSS}
}

@media (max-width: 720px) {
  .rc-header-inner { flex-direction: column; align-items: flex-start; padding: 20px 16px; }
  .rc-badge { align-self: stretch; }
  .rc-school-name { font-size: 21px; }
  .rc-body { padding: 16px 12px; }
  .rc-id { flex-direction: column; align-items: flex-start; }
  .rc-id-pos { border-left: 0; padding-left: 0; text-align: left; }
  .rc-igrid, .rc-nextgrid, .rc-signgrid, .rc-lower-grid { grid-template-columns: 1fr; }
  .rc-sumgrid, .rc-gkey { grid-template-columns: repeat(2, 1fr); }
  .rc-footer { flex-direction: column; align-items: flex-start; }
}
`;

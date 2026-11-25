import React, { useMemo, useState } from 'react';
import { User } from 'lucide-react';

/* ───────────── Grading Scale Config ───────────── */
export const TERMS = [
  { value: 'FIRST',  label: 'First Term'  },
  { value: 'SECOND', label: 'Second Term' },
  { value: 'THIRD',  label: 'Third Term'  },
];

export const GRADES = [
  { g: 'A', min: 75, range: '75–100', label: 'Excellent', fg: '#166534', bg: '#dcfce7', remark: 'Excellent'  },
  { g: 'B', min: 65, range: '65–74',  label: 'Very good', fg: '#1d4ed8', bg: '#dbeafe', remark: 'Very good'  },
  { g: 'C', min: 55, range: '55–64',  label: 'Good',      fg: '#92400e', bg: '#fef3c7', remark: 'Good'       },
  { g: 'D', min: 45, range: '45–54',  label: 'Pass',      fg: '#c2410c', bg: '#ffedd5', remark: 'Pass'       },
  { g: 'E', min: 40, range: '40–44',  label: 'Poor',      fg: '#7e22ce', bg: '#f3e8ff', remark: 'Needs work' },
  { g: 'F', min: 0,  range: '0–39',   label: 'Fail',      fg: '#b91c1c', bg: '#fee2e2', remark: 'Fail'       },
];

export const gradeInfo = (g) => GRADES.find((x) => x.g === g) || { fg: '#374151', bg: '#f3f4f6' };
export const gradeFor  = (score) =>
  score == null || isNaN(score) ? null : GRADES.find((x) => score >= x.min) || GRADES[GRADES.length - 1];

const REMARKS = [
  [75, 'An outstanding performance. This student demonstrates excellent mastery across all subjects. Keep it up!'],
  [65, 'A very commendable result. With focused effort and dedication, even greater heights are within reach.'],
  [55, 'A satisfactory performance. Dedicating more study time to weaker subjects will bring steady improvement.'],
  [45, 'A fair result. Greater diligence and consistent study habits are strongly encouraged going forward.'],
  [40, 'Performance is below expectation. Parents and guardians are advised to provide closer academic support at home.'],
  [0,  'An unsatisfactory performance. Urgent improvement is required. Significant effort must be dedicated next term.'],
];
export const autoRemark = (avg) => (avg ? REMARKS.find(([min]) => avg >= min)[1] : '');

export const PSYCHOMOTOR_TRAITS = [
  'Attentiveness',
  'Handwriting',
  'Honesty',
  'Neatness',
  'Politeness',
  'Punctuality',
  'Speech Fluency',
  'Sports & Games',
];

export const ordinal = (n) => {
  const num = Number(n);
  if (!Number.isInteger(num)) return n ?? '—';
  const v = num % 100, s = ['th', 'st', 'nd', 'rd'];
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* ───────────── Reusable Section ───────────── */
const Section = ({ title, children, className = '' }) => (
  <section className={`rc-sec ${className}`}>
    <h2 className="rc-sh">{title}</h2>
    {children}
  </section>
);

/* ───────────── Single Report Card Document ───────────── */
export function ReportCardDocument({
  data,
  settings,
  session,
  term,
  isBulk = false,
  cardId = 'rc-card',
}) {
  const { student, results = [], summary = {}, psychomotor: savedPsychomotor } = data || {};
  const [localPsychomotor, setLocalPsychomotor] = useState({});

  /* Derived statistics with STRICTLY whole number totals */
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

  // Get psychomotor rating
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
    if (isBulk) return;
    setLocalPsychomotor(prev => ({ ...prev, [trait]: rating }));
  };

  if (!student) return null;

  return (
    <article
      id={cardId}
      className={`rc-card ${isSenior ? 'theme-senior' : 'theme-junior'} ${isBulk ? 'rc-bulk-card' : ''}`}
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
                    const roundedTotal = r.total != null ? Math.round(r.total) : null;
                    const gi = gradeFor(roundedTotal);
                    const letter = gi?.g || r.grade || '—';
                    const col = gradeInfo(letter);
                    const displayRemark = gi?.remark || r.remark || '—';
                    return (
                      <tr key={r.id || i} className={roundedTotal != null && roundedTotal < 40 ? 'rc-fail' : ''}>
                        <td className="rc-muted" style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td className="rc-sn">{subjectName(r)}</td>
                        <td className="c">{r.caScore ?? r.ca ?? '—'}</td>
                        <td className="c">{r.examScore ?? r.exam ?? '—'}</td>
                        <td className="rc-tot-cell">
                          <span className="rc-total" style={{ color: col.fg }}>
                            {roundedTotal != null ? roundedTotal : '—'}
                          </span>
                          <span className="rc-bar">
                            <i style={{ width: `${Math.min(roundedTotal || 0, 100)}%`, background: col.fg }} />
                          </span>
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
                  <b>Strongest:</b> {subjectName(stats.best)} ({stats.best ? Math.round(stats.best.total) : '—'}) &nbsp;·&nbsp;
                  <b>Needs Attention:</b> {subjectName(stats.worst)} ({stats.worst ? Math.round(stats.worst.total) : '—'})
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
  );
}

/* ───────────── Print Core CSS (Toner-Friendly + Fills A4 Gracefully) ───────────── */
export const PRINT_CORE_CSS = `
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
}

/* Theme variables:
   Junior: Royal Oxford Navy & Gold (Uses minimal Magenta toner)
   Senior: Academic Forest Emerald & Gold (Cyan + Yellow = ZERO % Magenta toner!)
*/
.theme-junior, #rc-card.theme-junior {
  --primary-theme: #0E244E;
  --secondary-theme: #1A3870;
  --accent-gold: #E3B84E;
  --header-bg: linear-gradient(125deg, #0A1B3B 0%, #153268 50%, #1C448E 100%);
  --ribbon-bg: linear-gradient(90deg, #C9952A, #F0C85A 30%, #C9952A 50%, #F0C85A 70%, #C9952A);
  --border-theme: #CBD5E1;
}

.theme-senior, #rc-card.theme-senior {
  --primary-theme: #064E3B;
  --secondary-theme: #047857;
  --accent-gold: #F0C85A;
  --header-bg: linear-gradient(125deg, #022C22 0%, #064E3B 50%, #065F46 100%);
  --ribbon-bg: linear-gradient(90deg, #B45309, #F0C85A 30%, #B45309 50%, #F0C85A 70%, #B45309);
  --border-theme: #A7F3D0;
}

.rc-card, #rc-card {
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
  background: #fff !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  overflow: hidden !important;
}

/* Bulk page-break rules */
.rc-bulk-card {
  page-break-after: always !important;
  break-after: page !important;
}
.rc-bulk-card:last-child {
  page-break-after: avoid !important;
  break-after: avoid !important;
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
.rc-sec { margin-top: 8px !important; }
.rc-sh {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-family: 'Fraunces', serif !important;
  font-size: 11.5px !important;
  font-weight: 700 !important;
  color: var(--primary-theme) !important;
  margin: 0 0 4px !important;
}
.rc-sh::after { content: '' !important; flex: 1 !important; height: 1px !important; background: #CBD5E1 !important; }

/* Academic Table */
.rc-table-wrap { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; }
.rc-table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
.rc-table thead tr { background: var(--primary-theme) !important; }
.rc-table th { padding: 5px 8px !important; font-size: 9px !important; color: rgba(255, 255, 255, .95) !important; font-weight: 700 !important; text-align: left !important; }
.rc-table th span { opacity: .75 !important; font-weight: 400 !important; font-size: 8px !important; }
.rc-table .c { text-align: center !important; }
.rc-table td { padding: 4.5px 8px !important; border-bottom: 1px solid #E2E8F0 !important; vertical-align: middle !important; }
.rc-table tbody tr:nth-child(even) { background: #F8FAFC !important; }
.rc-sn { font-weight: 600 !important; font-size: 10.5px !important; color: #0F172A !important; }
.rc-muted { color: #64748B !important; font-size: 9.5px !important; }
.rc-tot-cell { min-width: 80px !important; }
.rc-total { font-weight: 800 !important; font-size: 11.5px !important; display: inline-block !important; width: 24px !important; }
.rc-bar { display: inline-block !important; vertical-align: middle !important; width: 36px !important; height: 5px !important; border-radius: 2px !important; background: #E2E8F0 !important; margin-left: 4px !important; overflow: hidden !important; }
.rc-bar i { display: block !important; height: 100% !important; border-radius: 2px !important; }
.rc-gpill { display: inline-flex !important; align-items: center !important; justify-content: center !important; width: 19px !important; height: 19px !important; border-radius: 50% !important; font-weight: 800 !important; font-size: 9px !important; }

/* Lower 2 Columns */
.rc-lower-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 12px !important;
  margin-top: 8px !important;
}
.rc-lower-col { display: flex !important; flex-direction: column !important; gap: 6px !important; }

/* Psychomotor */
.rc-psycho-table-wrap { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-psycho-table { width: 100% !important; border-collapse: collapse !important; font-size: 9px !important; }
.rc-psycho-table thead tr { background: #F1F5F9 !important; border-bottom: 1px solid #CBD5E1 !important; }
.rc-psycho-th-trait { padding: 4px 8px !important; font-weight: 700 !important; text-align: left !important; color: var(--primary-theme) !important; }
.rc-psycho-th-num { width: 22px !important; padding: 4px 0 !important; font-weight: 800 !important; color: var(--primary-theme) !important; border-left: 1px solid #CBD5E1 !important; text-align: center !important; }
.rc-psycho-table td { padding: 3px 8px !important; border-bottom: 1px solid #E2E8F0 !important; }
.rc-psycho-trait { font-weight: 500 !important; color: #334155 !important; }
.rc-psycho-cell { border-left: 1px solid #CBD5E1 !important; font-weight: 800 !important; color: #166534 !important; text-align: center !important; font-size: 10.5px !important; }
.rc-psycho-cell.active { background: #F0FDF4 !important; }
.rc-psycho-key { padding: 3px 8px !important; background: #F8FAFC !important; border-top: 1px solid #CBD5E1 !important; font-size: 7.5px !important; color: #64748B !important; text-align: center !important; font-weight: 600 !important; }

/* Grading Scale */
.rc-gkey { display: grid !important; grid-template-columns: repeat(6, 1fr) !important; border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-gki { padding: 4px 2px !important; text-align: center !important; border-right: 1px solid #CBD5E1 !important; }
.rc-gki:last-child { border-right: 0 !important; }
.rc-gki-letter { font-family: 'Fraunces', serif !important; font-size: 13px !important; font-weight: 800 !important; line-height: 1 !important; }
.rc-gki-range { font-size: 8px !important; color: #475569 !important; font-weight: 600 !important; margin-top: 1px !important; }
.rc-gki-label { font-size: 7px !important; color: #64748B !important; }

/* Summary */
.rc-sumgrid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; border: 1px solid #CBD5E1 !important; border-radius: 6px !important; overflow: hidden !important; background: #fff !important; }
.rc-sumcard { padding: 5px 6px !important; border-right: 1px solid #CBD5E1 !important; text-align: center !important; }
.rc-sumcard:last-child { border-right: 0 !important; }
.rc-suml { font-size: 8px !important; color: #64748B !important; margin-bottom: 1px !important; font-weight: 600 !important; }
.rc-sumv { font-family: 'Fraunces', serif !important; font-size: 15px !important; font-weight: 800 !important; line-height: 1 !important; }
.rc-insight { font-size: 8.5px !important; color: #334155 !important; margin: 3px 0 0 !important; line-height: 1.3 !important; }

/* Remarks */
.rc-rbox { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; padding: 5px 8px !important; margin-bottom: 5px !important; background: #fff !important; }
.rc-rlabel { font-size: 8px !important; font-weight: 700 !important; color: var(--primary-theme) !important; margin-bottom: 1px !important; }
.rc-rtext { min-height: 26px !important; font-size: 9px !important; color: #334155 !important; line-height: 1.3 !important; border-top: 1px dashed #E2E8F0 !important; padding-top: 2px !important; }

/* Next Term */
.rc-nextgrid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
.rc-nextcard { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; padding: 5px 8px !important; background: #fff !important; }
.rc-nextl { font-size: 7.5px !important; color: #64748B !important; margin-bottom: 1px !important; font-weight: 600 !important; }
.rc-nextv { font-size: 10.5px !important; font-weight: 700 !important; color: #0F172A !important; }

/* Signatures */
.rc-signgrid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 20px !important; margin-top: 10px !important; }
.rc-signbox { text-align: center !important; }
.rc-signgap { height: 30px !important; }
.rc-signline { border-top: 1.5px solid var(--primary-theme) !important; margin-bottom: 3px !important; }
.rc-signtitle { font-size: 9.5px !important; font-weight: 700 !important; color: #0F172A !important; }
.rc-signrole { font-size: 8px !important; color: #64748B !important; }

/* Footer */
.rc-footer { margin-top: 6px !important; padding-top: 4px !important; border-top: 1px solid #CBD5E1 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 8px !important; color: #94A3B8 !important; }
.rc-footer-stamp { background: var(--primary-theme) !important; color: rgba(255, 255, 255, .9) !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 8px !important; font-weight: 600 !important; }
`;

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import { Download } from 'lucide-react';
import { classService } from '../../services';
import api from '../../services/api';
import { CURRENT_SESSION } from '../../utils/constants';
import { useSettings } from '../../context/SettingsContext';
import { exportCardImage } from './cardExport'; // adjust the path to wherever you saved cardExport.js

// ── Palette: cream & green (matches the school uniform) ──
export const C = {
  forest: '#14432A', green: '#1F6B3F', leaf: '#3E9A5E', sage: '#DCEBDD', mint: '#EEF5EC',
  cream: '#FBF6E9', sand: '#F1E8CE', ink: '#16251C', muted: '#6B7A6F', line: '#E6DDC2', gold: '#C8A24A',
};
export const SERIF = "'Playfair Display', Georgia, serif";
export const SANS = "'Inter', system-ui, sans-serif";

const DEMO = [
  { id: 's1', firstName: 'Adaeze', otherNames: 'Chidinma', middleName: 'Chidinma', lastName: 'Okonkwo', admissionNo: 'PCI-2026-0001', gender: 'Female', dateOfBirth: '2010-03-14', bloodGroup: 'O+', currentClass: { name: 'JSS 1A' }, session: CURRENT_SESSION, photo: null, parentPhone: '+234 803 000 1111', address: '12 Okota Road, Onitsha' },
  { id: 's2', firstName: 'Emeka', otherNames: 'Tobechukwu', middleName: 'Tobechukwu', lastName: 'Nwosu', admissionNo: 'PCI-2026-0002', gender: 'Male', dateOfBirth: '2009-07-22', bloodGroup: 'A+', currentClass: { name: 'JSS 1A' }, session: CURRENT_SESSION, photo: null, parentPhone: '+234 803 000 2222', address: '45 Niger Bridge Close' },
  { id: 's3', firstName: 'Chisom', otherNames: 'Blessing', middleName: 'Blessing', lastName: 'Eze', admissionNo: 'PCI-2026-0003', gender: 'Female', dateOfBirth: '2010-11-05', bloodGroup: 'B+', currentClass: { name: 'JSS 1A' }, session: CURRENT_SESSION, photo: null, parentPhone: '+234 803 000 3333', address: '7 GRA Avenue, Onitsha' },
  { id: 's4', firstName: 'Tunde', otherNames: 'Oluwafemi', middleName: 'Oluwafemi', lastName: 'Bakare', admissionNo: 'PCI-2026-0004', gender: 'Male', dateOfBirth: '2009-01-30', bloodGroup: 'AB+', currentClass: { name: 'JSS 1A' }, session: CURRENT_SESSION, photo: null, parentPhone: '+234 803 000 4444', address: '23 Fegge Road, Onitsha' },
];

function Crest({ size = 48, light = false }) {
  const a = light ? C.cream : C.green, b = light ? C.green : C.cream;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="37" fill={b} stroke={a} strokeWidth="3" />
      <path d="M40 16c10 6 16 14 16 26 0 11-7 19-16 24-9-5-16-13-16-24 0-12 6-20 16-26z" fill={a} />
      <path d="M40 24v34M40 34c-5-1-8-4-9-8M40 34c5-1 8-4 9-8M40 44c-5-1-8-4-9-8M40 44c5-1 8-4 9-8" stroke={b} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

const Label = ({ children }) => (
  <div style={{ fontSize: '0.46rem', fontWeight: 700, color: C.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{children}</div>
);

export function CardFront({ student, signature, logo, settings }) {
  const dob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const initials = `${student.firstName?.[0] || '?'}${student.lastName?.[0] || '?'}`.toUpperCase();
  const finalLogo = logo || settings?.logoUrl;
  const schoolName = settings?.schoolName || 'PATIMO COLLEGE';
  const otherNames = [student.firstName, student.otherNames || student.middleName].filter(Boolean).map(s => String(s).trim()).filter(Boolean).join(' ');
  const rest = [['Gender', student.gender || '—'], ['Date of Birth', dob]];
  const nameSize = (student.lastName || '').length > 14 ? '1.05rem' : '1.3rem';
  const siteBase = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || window.location.origin;
  const verifyUrl = student?.id ? `${siteBase}/idcards/verify/${student.id}` : (student?.admissionNo || '');
  return (
    <div style={{ width: 320, height: 500, borderRadius: 20, overflow: 'hidden', position: 'relative', fontFamily: SANS, flexShrink: 0, background: C.cream, boxShadow: '0 18px 40px rgba(20,67,42,0.18), 0 0 0 1px rgba(20,67,42,0.08)' }}>
      {/* Watermark */}
      <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.05, pointerEvents: 'none', zIndex: 0 }}>
        {finalLogo ? <img src={finalLogo} alt="" style={{ width: 190, height: 190, objectFit: 'contain', filter: 'grayscale(100%)' }} /> : <Crest size={190} />}
      </div>
      {/* Header */}
      <div style={{ height: 150, background: `linear-gradient(160deg, ${C.green} 0%, ${C.forest} 100%)`, position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: -50, right: -40, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', top: 40, left: -50, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '22px 18px 0' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            {finalLogo ? <img src={finalLogo} alt="logo" style={{ width: '82%', height: '82%', objectFit: 'contain' }} /> : <Crest size={36} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 46 }}>
            <div style={{ color: '#FFFFFF', fontFamily: SERIF, fontSize: schoolName.length > 18 ? '0.95rem' : '1.1rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{schoolName}</div>
            <div style={{ color: C.sand, fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 5, opacity: 0.85 }}>Student Identity Card</div>
          </div>
        </div>
        <svg viewBox="0 0 320 40" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 40 }}>
          <path d="M0 40V22C60 2 120 0 180 12s100 14 140-4v32z" fill={C.cream} />
        </svg>
      </div>

      {/* Photo (portrait passport frame) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -64, position: 'relative', zIndex: 10, transform: 'translateZ(10px)' }}>
        <div style={{ width: 106, height: 130, borderRadius: 24, padding: 4, background: C.cream, boxShadow: `0 0 0 2.5px ${C.leaf}, 0 12px 24px rgba(20,67,42,0.22)` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: '1.9rem', fontWeight: 700, color: C.green }}>
            {student.photo ? <img src={student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} /> : initials}
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{ textAlign: 'center', marginTop: 8, padding: '0 20px' }}>
        <div style={{ fontFamily: SERIF, fontSize: nameSize, fontWeight: 700, color: C.forest, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.1 }}>{student.lastName}</div>
        <div style={{ fontSize: '0.98rem', color: '#2E4A3A', marginTop: 4, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.25 }}>{otherNames}</div>
        <div style={{ display: 'inline-block', marginTop: 8, background: C.green, color: C.cream, fontSize: '0.62rem', fontWeight: 800, padding: '4px 18px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {(student.currentClass?.name || '—').replace(/\s+/g, '')}
        </div>
      </div>

      {/* Details (semi-transparent so the watermark shows through) */}
      <div style={{ margin: '12px 18px 0', display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(20,67,42,0.93)', borderRadius: 12, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.46rem', fontWeight: 700, color: 'rgba(251,246,233,0.65)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Admission No</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: C.cream, letterSpacing: '0.08em' }}>{student.admissionNo}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length || 1}, 1fr)`, gap: 7 }}>
          {rest.map(([label, value]) => (
            <div key={label} style={{ background: 'rgba(238,245,236,0.55)', border: `1px solid ${C.sage}`, borderRadius: 12, padding: '6px 10px' }}>
              <Label>{label}</Label>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.ink, marginTop: 2, whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 76, background: C.sand, borderTop: `1px solid ${C.line}`, padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ height: 24, display: 'flex', alignItems: 'flex-end' }}>
            {signature && <img src={signature} alt="signature" style={{ height: 22, maxWidth: 90, objectFit: 'contain' }} />}
          </div>
          <div style={{ width: 92, borderTop: `1px solid ${C.forest}`, marginTop: 2 }} />
          <div style={{ fontSize: '0.42rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 3 }}>Principal's Signature</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: '0.38rem', fontWeight: 800, color: C.forest, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', lineHeight: 1.4 }}>Scan to<br />verify</div>
          <div style={{ background: '#FFFFFF', padding: 2, borderRadius: 8, border: `1px solid ${C.line}`, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            <QRCodeSVG
              value={verifyUrl}
              size={56}
              level="L"
              fgColor="#082015"
              bgColor="#FFFFFF"
              includeMargin={true}
            />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: `linear-gradient(90deg, ${C.green}, ${C.leaf})` }} />
    </div>
  );
}

export function CardBack({ student, settings }) {
  const finalLogo = settings?.logoUrl;
  const schoolName = settings?.schoolName || 'PATIMO COLLEGE';
  const rules = [
    'Wear this card visibly at all times on school premises.',
    'Report a lost card to the school administration immediately.',
    `This card is non-transferable and remains the property of ${schoolName}.`,
    'Tampering with this card will attract disciplinary action.',
  ];

  return (
    <div style={{ width: 320, height: 500, borderRadius: 20, overflow: 'hidden', position: 'relative', fontFamily: SANS, flexShrink: 0, background: C.cream, boxShadow: '0 18px 40px rgba(20,67,42,0.18), 0 0 0 1px rgba(20,67,42,0.08)' }}>
      <div style={{ height: 74, background: `linear-gradient(160deg, ${C.green}, ${C.forest})`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 9, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 46, height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.28)' }} />
        </div>
        <div style={{ position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center', color: C.cream, fontFamily: SERIF, fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.04em' }}>{schoolName}</div>
        <svg viewBox="0 0 320 24" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 24 }}>
          <path d="M0 24V10C80 -2 160 -2 240 8c40 5 60 4 80 0v16z" fill={C.cream} />
        </svg>
      </div>

      <div style={{ padding: '6px 26px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          {finalLogo ? <img src={finalLogo} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} /> : <Crest size={38} />}
        </div>
        <div style={{ fontSize: '0.56rem', color: C.muted, lineHeight: 1.7 }}>
          {settings?.address || 'Plot 13&14, Maito Bakery Street, Adesola, Ibadan'}<br />
          {settings?.phone || '+234 803 455 6007'} &nbsp;·&nbsp; {settings?.email || 'info@patimocollege.edu.ng'}
        </div>
      </div>

      <div style={{ margin: '14px 26px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ fontSize: '0.5rem', fontWeight: 800, color: C.green, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Rules &amp; Regulations</span>
        <div style={{ flex: 1, height: 1, background: C.line }} />
      </div>

      <div style={{ padding: '0 26px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 17, height: 17, borderRadius: 6, background: C.sage, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', fontWeight: 800 }}>{i + 1}</div>
            <p style={{ fontSize: '0.56rem', color: C.ink, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{rule}</p>
          </div>
        ))}
      </div>

      {student.parentPhone && (
        <div style={{ margin: '14px 26px 0', background: C.mint, border: `1px solid ${C.sage}`, borderRadius: 12, padding: '8px 12px' }}>
          <Label>Parent / Guardian Contact</Label>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.forest, marginTop: 2 }}>{student.parentPhone}</div>
        </div>
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 42, background: C.sand, borderTop: `1px solid ${C.line}`, padding: '0 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.56rem', color: C.muted, fontWeight: 600, letterSpacing: '0.06em' }}>{student.admissionNo}</span>
        <span style={{ fontSize: '0.56rem', color: C.green, fontWeight: 800, letterSpacing: '0.08em' }}>SESSION {student.session || settings?.currentSession || '2025/2026'}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: `linear-gradient(90deg, ${C.green}, ${C.leaf})` }} />
    </div>
  );
}

const fieldLabel = { color: C.muted, fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 };
const inputStyle = { width: '100%', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', color: C.ink, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const uploadBtn = (on) => ({ background: on ? C.sage : '#fff', color: on ? C.green : C.forest, border: `1px solid ${on ? C.leaf : C.line}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 });
const exportBtn = (bg, color, extra = {}) => ({ background: bg, color, border: 'none', padding: '6px 12px', borderRadius: 16, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, ...extra });

export default function IDCardPage() {
  const { currentSession } = useSettings();
  const [searchParams] = useSearchParams();
  const studentParamId = searchParams.get('student');

  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [logo, setLogo] = useState(null);
  const [flipped, setFlipped] = useState({});
  const [exportFormat, setExportFormat] = useState('png');
  const sigRef = useRef();
  const logoRef = useRef();

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [{ id: 'c1', name: 'JSS 1A' }, { id: 'c2', name: 'SS 3A' }],
  });

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE' },
  });

  useEffect(() => {
    if (studentParamId) {
      setLoading(true);
      api.get(`/students/${studentParamId}`)
        .then(r => {
          const s = r.data.student || r.data;
          if (s) setStudents([s]);
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [studentParamId]);

  const loadFile = (e, setter) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = ev => setter(ev.target.result); reader.readAsDataURL(file);
  };

  const loadStudents = async (cid) => {
    setClassId(cid); setStudents([]); setFlipped({});
    if (!cid) return; setLoading(true);
    try { const r = await api.get(`/students?classId=${cid}`); setStudents(r.data.students?.length ? r.data.students : DEMO); }
    catch { setStudents(DEMO); } finally { setLoading(false); }
  };

  const doSearch = async () => {
    if (!search.trim()) return; setLoading(true);
    try { const r = await api.get(`/students?search=${search}`); setStudents(r.data.students?.length ? r.data.students : DEMO); }
    catch { setStudents(DEMO); } finally { setLoading(false); }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportStudentImage = async (studentId, studentName, type = 'front') => {
    const label = type === 'front' ? 'Front' : type === 'back' ? 'Back' : 'Front & Back';
    try {
      toast.info(`Generating ${label} for ${studentName}…`);
      await exportCardImage(
        `export-${type}-${studentId}`,
        `${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_IDCard_${type.toUpperCase()}`,
        exportFormat
      );
      toast.success(`${label} exported!`);
    } catch (err) {
      console.error('Failed to export image:', err);
      toast.error('Could not generate image');
    }
  };

  const fmt = exportFormat.toUpperCase();

  return (
    <div className="id-card-generator-wrapper" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: C.cream, fontFamily: SANS }}>
      <style>{`
        /* Global flatten rule for export */
        .id-cards-export-view, .id-cards-export-view * { transform-style: flat !important; }

        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body, html { background: #FFFFFF !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .topbar, .sidebar, .id-cards-screen-view, button, input, select { display: none !important; }
          .id-cards-print-view, .id-cards-print-view * { transform-style: flat !important; }
          .id-cards-print-view { display: flex !important; flex-wrap: wrap !important; gap: 20px !important; justify-content: center !important; padding: 10px !important; }
          .id-card-pair { display: flex !important; gap: 16px !important; page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 24px !important; }
        }
        @media screen {
          .id-cards-print-view { display: none !important; }
        }
      `}</style>

      <div className="id-cards-screen-view" style={{ position: 'relative', zIndex: 10, padding: '40px 28px' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 8% 10%, rgba(62,154,94,0.16) 0%, transparent 45%), radial-gradient(circle at 95% 90%, rgba(200,162,74,0.14) 0%, transparent 45%)`, pointerEvents: 'none' }} />

        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h1 style={{ color: C.forest, fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, margin: 0 }}>ID Card Generator</h1>
          <p style={{ color: C.muted, fontSize: '0.88rem', marginTop: 6 }}>Generate, preview &amp; print student ID cards</p>
        </div>

        {/* Controls */}
        <div style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(14px)', border: `1px solid ${C.line}`, borderRadius: 20, padding: '20px 24px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', boxShadow: '0 6px 24px rgba(20,67,42,0.06)' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={fieldLabel}>Class</label>
            <select value={classId} onChange={e => loadStudents(e.target.value)} style={inputStyle}>
              <option value="">Choose class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={fieldLabel}>Search</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} placeholder="Name or admission no…" style={{ ...inputStyle, flex: 1, width: 'auto' }} />
              <button onClick={doSearch} style={{ background: C.green, color: C.cream, border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>Go</button>
            </div>
          </div>
          <div>
            <label style={fieldLabel}>School Logo</label>
            <button onClick={() => logoRef.current.click()} style={uploadBtn(logo)}>{logo ? '✓ Logo set' : 'Upload logo'}</button>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => loadFile(e, setLogo)} />
          </div>
          <div>
            <label style={fieldLabel}>Authorized Signature</label>
            <button onClick={() => sigRef.current.click()} style={uploadBtn(signature)}>{signature ? '✓ Signature set' : 'Upload signature'}</button>
            <input ref={sigRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => loadFile(e, setSignature)} />
          </div>
          <div>
            <label style={fieldLabel}>Export format</label>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={{ ...inputStyle, width: 90 }}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>
          {students.length > 0 && (
            <button onClick={handlePrint} style={{ background: `linear-gradient(135deg, ${C.green}, ${C.forest})`, color: C.cream, border: 'none', borderRadius: 10, padding: '11px 22px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.04em', boxShadow: '0 6px 16px rgba(20,67,42,0.25)' }}>
              🖨 Print {students.length} Cards
            </button>
          )}
        </div>

        {students.length > 0 && (
          <p style={{ color: C.muted, fontSize: '0.74rem', marginBottom: 22, textAlign: 'center' }}>Click any card to flip it and see the back</p>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 38, height: 38, border: `3px solid ${C.sage}`, borderTopColor: C.green, borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: '0.82rem' }}>Loading students…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading && students.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: C.muted }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: C.sage, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🪪</div>
            <h3 style={{ color: C.forest, marginBottom: 6, fontFamily: SERIF }}>No students loaded</h3>
            <p style={{ fontSize: '0.85rem' }}>Select a class or search for a student to generate ID cards.</p>
          </div>
        )}

        {!loading && students.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'center' }}>
            {students.map(s => (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  onClick={() => setFlipped(f => ({ ...f, [s.id]: !f[s.id] }))}
                  style={{ cursor: 'pointer', perspective: 1200, padding: 8, background: C.cream, borderRadius: 24 }}
                >
                  <div style={{ transition: 'transform 0.7s cubic-bezier(0.4,0,0.2,1)', transformStyle: 'preserve-3d', transform: flipped[s.id] ? 'rotateY(180deg)' : 'rotateY(0)', position: 'relative', width: 320, height: 500 }}>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}><CardFront student={s} signature={signature} logo={logo} settings={settings} /></div>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}><CardBack student={s} settings={settings} /></div>
                  </div>
                </div>

                <p style={{ color: C.muted, fontSize: '0.64rem', marginTop: 8, marginBottom: 10, letterSpacing: '0.06em' }}>{flipped[s.id] ? 'Back View' : 'Front View'} · tap card to flip</p>

                {/* Export buttons */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'front'); }}
                    style={exportBtn(C.forest, C.cream, { boxShadow: '0 2px 6px rgba(0,0,0,0.1)' })}
                  >
                    <Download size={11} /> Front {fmt}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'back'); }}
                    style={exportBtn(C.green, C.cream, { boxShadow: '0 2px 6px rgba(0,0,0,0.1)' })}
                  >
                    <Download size={11} /> Back {fmt}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'pair'); }}
                    style={exportBtn(C.mint, C.forest, { border: `1px solid ${C.sage}` })}
                  >
                    <Download size={11} /> Both (Pair)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offscreen flat export containers (captured by html-to-image) */}
      <div className="id-cards-export-view" style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none' }}>
        {students.map(s => (
          <div key={`export-group-${s.id}`}>
            <div id={`export-front-${s.id}`} style={{ display: 'inline-block' }}>
              <CardFront student={s} signature={signature} logo={logo} settings={settings} />
            </div>
            <div id={`export-back-${s.id}`} style={{ display: 'inline-block' }}>
              <CardBack student={s} settings={settings} />
            </div>
            <div id={`export-pair-${s.id}`} style={{ display: 'inline-flex', gap: 16, padding: 16, background: C.cream, borderRadius: 20 }}>
              <CardFront student={s} signature={signature} logo={logo} settings={settings} />
              <CardBack student={s} settings={settings} />
            </div>
          </div>
        ))}
      </div>

      {/* Dedicated print view */}
      <div className="id-cards-print-view">
        {students.map(s => (
          <div key={s.id} className="id-card-pair">
            <CardFront student={s} signature={signature} logo={logo} settings={settings} />
            <CardBack student={s} settings={settings} />
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-toastify';
import { Download, Printer, FileText, Layers, Check } from 'lucide-react';
import { classService } from '../../services';
import api from '../../services/api';
import { CURRENT_SESSION } from '../../utils/constants';
import { useSettings } from '../../context/SettingsContext';
import { exportCardImage, exportStudentCardPDF, exportBatchCardsPDF } from './cardExport';

// ── Palette: High-contrast rich emerald, deep forest & warm ivory ──
// Calibrated for crisp physical printing without washed-out/whitish tones
export const C = {
  forest: '#0D3820',
  green: '#166534',
  leaf: '#1E824C',
  sage: '#D0E5D4',
  mint: '#EBF4ED',
  cream: '#FAF7EE',
  sand: '#F1E8D5',
  ink: '#091D11',
  muted: '#284634',
  line: '#DECFA8',
  gold: '#C8A24A',
  goldLight: '#F5E4B5',
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

const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#1B4D31', letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.2, ...style }}>
    {children}
  </div>
);

export function CardFront({ student, signature, logo, settings }) {
  const initials = `${student.firstName?.[0] || '?'}${student.lastName?.[0] || '?'}`.toUpperCase();
  const finalLogo = logo || settings?.logoUrl;
  const schoolName = settings?.schoolName || 'PATIMO COLLEGE';
  const otherNames = [student.firstName, student.otherNames || student.middleName].filter(Boolean).map(s => String(s).trim()).filter(Boolean).join(' ');
  const rest = [['Gender', student.gender || '—'], ['E-Learning ID', student.moodleUsername || '—']];
  const nameSize = (student.lastName || '').length > 13 ? '1.15rem' : '1.32rem';
  const siteBase = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || window.location.origin;
  const identifier = student?.admissionNo || student?.id || '';
  const verifyUrl = identifier ? `${siteBase}/idcards/verify/${encodeURIComponent(identifier)}` : '';

  return (
    <div style={{ width: 320, height: 500, borderRadius: 20, overflow: 'hidden', position: 'relative', fontFamily: SANS, flexShrink: 0, background: C.cream, boxShadow: '0 18px 40px rgba(13,56,32,0.18), 0 0 0 1.5px rgba(13,56,32,0.14)' }}>
      {/* Watermark with authentic faint imprint */}
      <div style={{ position: 'absolute', top: 245, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: 0.07, pointerEvents: 'none', zIndex: 0 }}>
        {finalLogo ? <img src={finalLogo} alt="" style={{ width: 190, height: 190, objectFit: 'contain', filter: 'grayscale(100%)' }} /> : <Crest size={190} />}
      </div>

      {/* Header with rich emerald & forest gradient plus gold divider */}
      <div style={{ height: 148, background: 'linear-gradient(155deg, #166534 0%, #0D3820 100%)', position: 'relative', zIndex: 1, borderBottom: `2.5px solid ${C.gold}` }}>
        <div style={{ position: 'absolute', top: -50, right: -40, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', top: 40, left: -50, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 16px 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            {finalLogo ? <img src={finalLogo} alt="logo" style={{ width: '84%', height: '84%', objectFit: 'contain' }} /> : <Crest size={38} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 48, textAlign: 'left' }}>
            <div style={{ color: '#FFFFFF', fontFamily: SERIF, fontSize: schoolName.length > 20 ? '0.98rem' : '1.14rem', fontWeight: 800, lineHeight: 1.15, letterSpacing: '0.04em', textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>{schoolName}</div>
            <div style={{ color: C.goldLight, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>Student Identity Card</div>
          </div>
        </div>

        <svg viewBox="0 0 320 40" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 40 }}>
          <path d="M0 40V22C60 2 120 0 180 12s100 14 140-4v32z" fill={C.cream} />
        </svg>
      </div>

      {/* Photo (portrait passport frame) */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -64, position: 'relative', zIndex: 10, transform: 'translateZ(10px)' }}>
        <div style={{ width: 108, height: 132, borderRadius: 22, padding: 3.5, background: '#FFFFFF', boxShadow: `0 0 0 2.5px ${C.green}, 0 10px 24px rgba(13,56,32,0.25)` }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden', background: '#F0F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: '2rem', fontWeight: 700, color: C.green }}>
            {student.photo ? <img src={student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} /> : initials}
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{ textAlign: 'center', marginTop: 7, padding: '0 18px' }}>
        <div style={{ fontFamily: SERIF, fontSize: nameSize, fontWeight: 800, color: '#092314', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.15 }}>{student.lastName}</div>
        <div style={{ fontSize: '1.02rem', color: '#164327', marginTop: 4, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.25 }}>{otherNames}</div>
        <div style={{ display: 'inline-block', marginTop: 6, background: '#135E34', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 800, padding: '4px 16px', borderRadius: 20, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(19,94,52,0.3)' }}>
          {(student.currentClass?.name || '—').replace(/\s+/g, ' ')}
        </div>
      </div>

      {/* Details (Solid crisp panels that will never wash out on printer) */}
      <div style={{ margin: '9px 18px 0', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 1 }}>
        <div style={{ background: '#0D3820', borderRadius: 10, padding: '7px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 6px rgba(13,56,32,0.2)' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#F1E8CE', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Admission No</span>
          <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.08em', fontFamily: SANS }}>{student.admissionNo}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rest.length || 1}, 1fr)`, gap: 6 }}>
          {rest.map(([label, value]) => (
            <div key={label} style={{ background: '#FFFFFF', border: '1.5px solid #C8DEC9', borderRadius: 10, padding: '5px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Label>{label}</Label>
              <div style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0B2315', marginTop: 2, whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, background: C.sand, borderTop: `1.5px solid ${C.line}`, padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ height: 26, display: 'flex', alignItems: 'flex-end' }}>
            {signature && <img src={signature} alt="signature" style={{ height: 24, maxWidth: 96, objectFit: 'contain' }} />}
          </div>
          <div style={{ width: 100, borderTop: '1.5px solid #0D3820', marginTop: 2 }} />
          <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#1B4D31', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>Principal's Signature</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ fontSize: '0.54rem', fontWeight: 800, color: '#0D3820', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right', lineHeight: 1.35 }}>Scan to<br />Verify</div>
          <div style={{ background: '#FFFFFF', padding: 2, borderRadius: 8, border: '1.5px solid #C8DEC9', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            <QRCodeSVG
              value={verifyUrl || 'VERIFY'}
              size={56}
              level="M"
              fgColor="#000000"
              bgColor="#FFFFFF"
              includeMargin={true}
            />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'linear-gradient(90deg, #135E34, #1E824C)' }} />
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
    <div style={{ width: 320, height: 500, borderRadius: 20, overflow: 'hidden', position: 'relative', fontFamily: SANS, flexShrink: 0, background: C.cream, boxShadow: '0 18px 40px rgba(13,56,32,0.18), 0 0 0 1.5px rgba(13,56,32,0.14)' }}>
      {/* Header bar with gold trim */}
      <div style={{ height: 76, background: 'linear-gradient(155deg, #166534, #0D3820)', position: 'relative', borderBottom: `2.5px solid ${C.gold}` }}>
        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 7, borderRadius: 4, background: 'rgba(0,0,0,0.3)' }} />
        </div>
        <div style={{ position: 'absolute', top: 26, left: 0, right: 0, textAlign: 'center', color: '#FFFFFF', fontFamily: SERIF, fontSize: '0.98rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{schoolName}</div>
        <svg viewBox="0 0 320 20" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 20 }}>
          <path d="M0 20V8C80 -2 160 -2 240 6c40 4 60 3 80 0v14z" fill={C.cream} />
        </svg>
      </div>

      {/* School Contact Section */}
      <div style={{ padding: '6px 20px 0', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          {finalLogo ? <img src={finalLogo} alt="" style={{ width: 38, height: 38, objectFit: 'contain' }} /> : <Crest size={38} />}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#143622', lineHeight: 1.55, fontWeight: 600 }}>
          {settings?.address || 'Plot 13&14, Maito Bakery Street, Adesola, Ibadan'}<br />
          <span style={{ fontWeight: 700, color: '#0D3820' }}>{settings?.phone || '+234 803 455 6007'}</span> &nbsp;·&nbsp; {settings?.email || 'info@patimocollege.edu.ng'}
        </div>
      </div>

      {/* Rules Divider Banner */}
      <div style={{ margin: '10px 22px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 1.5, background: C.line }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#135E34', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rules &amp; Regulations</span>
        <div style={{ flex: 1, height: 1.5, background: C.line }} />
      </div>

      {/* Rules List */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 20, height: 20, borderRadius: 6, background: '#D6EADB', color: '#0D3820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.66rem', fontWeight: 800, border: '1px solid #ACD4B6', flexShrink: 0 }}>{i + 1}</div>
            <p style={{ fontSize: '0.68rem', color: '#0B1F13', lineHeight: 1.45, margin: 0, fontWeight: 600 }}>{rule}</p>
          </div>
        ))}
      </div>

      {/* Parent Contact Box */}
      {student.parentPhone && (
        <div style={{ margin: '12px 20px 0', background: '#FFFFFF', border: '1.5px solid #C8DEC9', borderRadius: 10, padding: '7px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#1B4D31', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Parent / Guardian Contact</div>
          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0D3820', marginTop: 2, letterSpacing: '0.04em' }}>{student.parentPhone}</div>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 42, background: C.sand, borderTop: `1.5px solid ${C.line}`, padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.70rem', color: '#143622', fontWeight: 700, letterSpacing: '0.06em' }}>{student.admissionNo}</span>
        <span style={{ fontSize: '0.70rem', color: '#0D3820', fontWeight: 800, letterSpacing: '0.08em' }}>SESSION {student.session || settings?.currentSession || '2025/2026'}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: 'linear-gradient(90deg, #135E34, #1E824C)' }} />
    </div>
  );
}

const fieldLabel = { color: '#1B4D31', fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 6 };
const inputStyle = { width: '100%', background: '#fff', border: `1.5px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', color: '#0B1F13', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' };
const uploadBtn = (on) => ({ background: on ? '#D6EADB' : '#fff', color: on ? '#0D3820' : '#14432A', border: `1.5px solid ${on ? '#166534' : C.line}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 });

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
  const [printStudentId, setPrintStudentId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

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
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE', signatureUrl: null },
  });

  // Auto-load saved signature from settings when page first loads
  useEffect(() => {
    if (settings?.signatureUrl && !signature) {
      setSignature(settings.signatureUrl);
    }
  }, [settings?.signatureUrl]);

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

  // Clean up print state after print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintStudentId(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const loadFile = (e, setter) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = ev => setter(ev.target.result); reader.readAsDataURL(file);
  };

  const uploadSignatureFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setSignature(ev.target.result);
    reader.readAsDataURL(file);
    try {
      const form = new FormData();
      form.append('signature', file);
      const { data } = await api.post('/settings/signature', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.signatureUrl) setSignature(data.signatureUrl);
      toast.success('Signature saved — will auto-load next time!');
    } catch {
      toast.error('Signature preview is set but could not be saved to server.');
    }
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

  const handlePrintAll = () => {
    setPrintStudentId(null);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePrintIndividual = (studentId) => {
    setPrintStudentId(studentId);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportPDF = async (student, mode = 'cr80') => {
    try {
      setDownloadingId(`${student.id}-${mode}`);
      const modeLabel = mode === 'cr80' ? 'CR80 Card PDF' : mode === 'a4' ? 'A4 Sheet PDF' : `${mode.toUpperCase()} PDF`;
      toast.info(`Generating ${modeLabel} for ${student.lastName} ${student.firstName}…`);
      await exportStudentCardPDF(student, {
        mode,
        schoolName: settings?.schoolName || 'PATIMO COLLEGE',
      });
      toast.success(`${modeLabel} downloaded!`);
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBatchPDF = async (mode = 'cr80') => {
    if (!students.length) return;
    try {
      setBatchDownloading(true);
      toast.info(`Generating ${mode === 'cr80' ? 'CR80' : 'A4'} PDF for ${students.length} students…`);
      await exportBatchCardsPDF(students, {
        mode,
        schoolName: settings?.schoolName || 'PATIMO COLLEGE',
      });
      toast.success(`Batch PDF generated for ${students.length} students!`);
    } catch (err) {
      console.error('Batch PDF export error:', err);
      toast.error('Failed to generate batch PDF');
    } finally {
      setBatchDownloading(false);
    }
  };

  const exportStudentImage = async (studentId, studentName, type = 'front') => {
    const label = type === 'front' ? 'Front' : type === 'back' ? 'Back' : 'Front & Back';
    try {
      toast.info(`Generating ${label} image for ${studentName}…`);
      await exportCardImage(
        `export-${type}-${studentId}`,
        `${studentName.replace(/[^a-zA-Z0-9_-]/g, '_')}_IDCard_${type.toUpperCase()}`,
        exportFormat
      );
      toast.success(`${label} image exported!`);
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
          body, html {
            background: #FFFFFF !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          .topbar, .sidebar, .id-cards-screen-view, button, input, select {
            display: none !important;
          }
          .id-cards-print-view, .id-cards-print-view * {
            transform-style: flat !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .id-cards-print-view {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 20px !important;
            padding: 10px !important;
          }
          .id-card-pair {
            display: flex !important;
            gap: 16px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 24px !important;
            justify-content: center !important;
          }
        }
        @media screen {
          .id-cards-print-view { display: none !important; }
        }
      `}</style>

      <div className="id-cards-screen-view" style={{ position: 'relative', zIndex: 10, padding: '40px 28px' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 8% 10%, rgba(22,101,52,0.12) 0%, transparent 45%), radial-gradient(circle at 95% 90%, rgba(200,162,74,0.14) 0%, transparent 45%)`, pointerEvents: 'none' }} />

        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <h1 style={{ color: C.forest, fontFamily: SERIF, fontSize: '2.1rem', fontWeight: 800, margin: 0 }}>ID Card Generator</h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', marginTop: 6, fontWeight: 500 }}>High-Resolution PDF, Direct Print &amp; Image Export for Student Identity Cards</p>
        </div>

        {/* Controls */}
        <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(14px)', border: `1.5px solid ${C.line}`, borderRadius: 20, padding: '20px 24px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', boxShadow: '0 6px 24px rgba(13,56,32,0.06)' }}>
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
              <button onClick={doSearch} style={{ background: C.green, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>Go</button>
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
            <input ref={sigRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadSignatureFile} />
          </div>
          <div>
            <label style={fieldLabel}>Image format</label>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={{ ...inputStyle, width: 90 }}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>

          {/* Batch Actions */}
          {students.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={handlePrintAll}
                title="Print all loaded ID cards using browser print"
                style={{
                  background: `linear-gradient(135deg, ${C.green}, ${C.forest})`,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '11px 18px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  boxShadow: '0 6px 16px rgba(13,56,32,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={15} /> Print All ({students.length})
              </button>

              <button
                disabled={batchDownloading}
                onClick={() => handleBatchPDF('cr80')}
                title="Download 1 multi-page PDF containing all students formatted for PVC card printers"
                style={{
                  background: '#FFFFFF',
                  color: C.forest,
                  border: `1.5px solid ${C.forest}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}
              >
                <FileText size={15} /> All PDF (CR80)
              </button>

              <button
                disabled={batchDownloading}
                onClick={() => handleBatchPDF('a4')}
                title="Download 1 multi-page PDF with A4 sheets (crop marks included) for all students"
                style={{
                  background: '#FFFFFF',
                  color: C.green,
                  border: `1.5px solid ${C.green}`,
                  borderRadius: 10,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                }}
              >
                <FileText size={15} /> All PDF (A4 Sheets)
              </button>
            </div>
          )}
        </div>

        {students.length > 0 && (
          <p style={{ color: C.muted, fontSize: '0.78rem', marginBottom: 22, textAlign: 'center', fontWeight: 600 }}>
            💡 Tip: Click any card to flip between Front and Back. Use the buttons below each card to print or download as high-res PDF.
          </p>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 38, height: 38, border: `3px solid ${C.sage}`, borderTopColor: C.green, borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: C.muted, fontSize: '0.85rem', fontWeight: 600 }}>Loading students…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading && students.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: C.muted }}>
            <div style={{ width: 72, height: 72, borderRadius: 24, background: C.sage, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🪪</div>
            <h3 style={{ color: C.forest, marginBottom: 6, fontFamily: SERIF, fontSize: '1.4rem' }}>No students loaded</h3>
            <p style={{ fontSize: '0.88rem' }}>Select a class or search for a student to generate ID cards.</p>
          </div>
        )}

        {!loading && students.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, justifyContent: 'center' }}>
            {students.map(s => (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* 3D Flip Card Container */}
                <div
                  onClick={() => setFlipped(f => ({ ...f, [s.id]: !f[s.id] }))}
                  style={{ cursor: 'pointer', perspective: 1200, padding: 8, background: C.cream, borderRadius: 24 }}
                >
                  <div style={{ transition: 'transform 0.7s cubic-bezier(0.4,0,0.2,1)', transformStyle: 'preserve-3d', transform: flipped[s.id] ? 'rotateY(180deg)' : 'rotateY(0)', position: 'relative', width: 320, height: 500 }}>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}><CardFront student={s} signature={signature} logo={logo} settings={settings} /></div>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}><CardBack student={s} settings={settings} /></div>
                  </div>
                </div>

                <p style={{ color: C.muted, fontSize: '0.68rem', marginTop: 8, marginBottom: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
                  {flipped[s.id] ? 'BACK VIEW' : 'FRONT VIEW'} · TAP CARD TO FLIP
                </p>

                {/* Individual Student Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', maxWidth: 320 }}>
                  
                  {/* Primary PDF Download Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      disabled={!!downloadingId}
                      onClick={(e) => { e.stopPropagation(); handleExportPDF(s, 'cr80'); }}
                      title="Download standard CR80 PVC Card PDF (54 x 85.6 mm, 2 pages) for ID card printers"
                      style={{
                        background: 'linear-gradient(135deg, #0D3820, #14432A)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 10px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        boxShadow: '0 2px 8px rgba(13,56,32,0.22)',
                      }}
                    >
                      <FileText size={13} />
                      {downloadingId === `${s.id}-cr80` ? 'Generating…' : 'PDF (CR80 Card)'}
                    </button>

                    <button
                      type="button"
                      disabled={!!downloadingId}
                      onClick={(e) => { e.stopPropagation(); handleExportPDF(s, 'a4'); }}
                      title="Download A4 Sheet PDF (Front & Back side-by-side with cut marks) for paper & lamination"
                      style={{
                        background: 'linear-gradient(135deg, #166534, #1E824C)',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '8px 10px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        boxShadow: '0 2px 8px rgba(22,101,52,0.22)',
                      }}
                    >
                      <FileText size={13} />
                      {downloadingId === `${s.id}-a4` ? 'Generating…' : 'PDF (A4 Sheet)'}
                    </button>
                  </div>

                  {/* Individual Print & High-Res Image Pair */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handlePrintIndividual(s.id); }}
                      title="Open print dialog for this student's ID card (Front & Back)"
                      style={{
                        background: '#FFFFFF',
                        color: '#0D3820',
                        border: '1.5px solid #0D3820',
                        padding: '7px 10px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <Printer size={13} />
                      Print Card
                    </button>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'pair'); }}
                      title={`Download Front & Back pair as high-res ${fmt}`}
                      style={{
                        background: '#EBF4ED',
                        color: '#0D3820',
                        border: '1.5px solid #D0E5D4',
                        padding: '7px 10px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                      }}
                    >
                      <Download size={13} />
                      Both ({fmt})
                    </button>
                  </div>

                  {/* Separate Sides Quick Links */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'front'); }}
                      style={{ background: 'transparent', border: 'none', color: '#1B4D31', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Front {fmt}
                    </button>
                    <span style={{ color: '#B5CFBA', fontSize: '0.64rem' }}>•</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); exportStudentImage(s.id, `${s.lastName}_${s.firstName}`, 'back'); }}
                      style={{ background: 'transparent', border: 'none', color: '#1B4D31', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Back {fmt}
                    </button>
                    <span style={{ color: '#B5CFBA', fontSize: '0.64rem' }}>•</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleExportPDF(s, 'front'); }}
                      style={{ background: 'transparent', border: 'none', color: '#1B4D31', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Front PDF
                    </button>
                    <span style={{ color: '#B5CFBA', fontSize: '0.64rem' }}>•</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleExportPDF(s, 'back'); }}
                      style={{ background: 'transparent', border: 'none', color: '#1B4D31', fontSize: '0.64rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Back PDF
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offscreen flat export containers (captured by html-to-image and jsPDF) */}
      <div className="id-cards-export-view" style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none' }}>
        {students.map(s => (
          <div key={`export-group-${s.id}`}>
            <div id={`export-front-${s.id}`} style={{ display: 'inline-block', background: '#FFFFFF', padding: 0 }}>
              <CardFront student={s} signature={signature} logo={logo} settings={settings} />
            </div>
            <div id={`export-back-${s.id}`} style={{ display: 'inline-block', background: '#FFFFFF', padding: 0 }}>
              <CardBack student={s} settings={settings} />
            </div>
            <div id={`export-pair-${s.id}`} style={{ display: 'inline-flex', gap: 16, padding: 16, background: '#FFFFFF', borderRadius: 20 }}>
              <CardFront student={s} signature={signature} logo={logo} settings={settings} />
              <CardBack student={s} settings={settings} />
            </div>
          </div>
        ))}
      </div>

      {/* Dedicated browser print view (handles single student or batch) */}
      <div className="id-cards-print-view">
        {(printStudentId ? students.filter(s => s.id === printStudentId) : students).map(s => (
          <div key={s.id} className="id-card-pair">
            <CardFront student={s} signature={signature} logo={logo} settings={settings} />
            <CardBack student={s} settings={settings} />
          </div>
        ))}
      </div>
    </div>
  );
}

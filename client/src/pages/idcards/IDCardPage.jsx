import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { classService } from '../../services';
import api from '../../services/api';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';

const DEMO = [
  { id:'s1', firstName:'Adaeze',  middleName:'Chidinma',   lastName:'Okonkwo', admissionNo:'PCI-2026-0001', gender:'Female', dateOfBirth:'2010-03-14', bloodGroup:'O+',  currentClass:{ name:'JSS 1A' }, session:CURRENT_SESSION, photo:null, parentPhone:'+234 803 000 1111', address:'12 Okota Road, Onitsha' },
  { id:'s2', firstName:'Emeka',   middleName:'Tobechukwu', lastName:'Nwosu',   admissionNo:'PCI-2026-0002', gender:'Male',   dateOfBirth:'2009-07-22', bloodGroup:'A+',  currentClass:{ name:'JSS 1A' }, session:CURRENT_SESSION, photo:null, parentPhone:'+234 803 000 2222', address:'45 Niger Bridge Close' },
  { id:'s3', firstName:'Chisom',  middleName:'Blessing',   lastName:'Eze',     admissionNo:'PCI-2026-0003', gender:'Female', dateOfBirth:'2010-11-05', bloodGroup:'B+',  currentClass:{ name:'JSS 1A' }, session:CURRENT_SESSION, photo:null, parentPhone:'+234 803 000 3333', address:'7 GRA Avenue, Onitsha' },
  { id:'s4', firstName:'Tunde',   middleName:'Oluwafemi',  lastName:'Bakare',  admissionNo:'PCI-2026-0004', gender:'Male',   dateOfBirth:'2009-01-30', bloodGroup:'AB+', currentClass:{ name:'JSS 1A' }, session:CURRENT_SESSION, photo:null, parentPhone:'+234 803 000 4444', address:'23 Fegge Road, Onitsha' },
];

function Crest({ size=48, dark=false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="37" fill={dark?'rgba(255,255,255,0.08)':'#F8FAFC'} stroke={dark?'#EAB308':'#1E3A8A'} strokeWidth="2.5"/>
      <rect x="22" y="28" width="36" height="24" rx="3" fill={dark?'#EAB308':'#1E3A8A'} opacity="0.95"/>
      <rect x="22" y="28" width="18" height="24" rx="2" fill={dark?'#1E3A8A':'#EAB308'} opacity="0.85"/>
      <line x1="40" y1="28" x2="40"
       y2="52" stroke={dark?'#1E3A8A':'#ffffff'} strokeWidth="2"/>
      <rect x="37" y="14" width="6" height="16" rx="2" fill="#EAB308"/>
      <ellipse cx="40" cy="13" rx="6" ry="7" fill="#EAB308" opacity="0.9"/>
      <ellipse cx="40" cy="11" rx="4" ry="4" fill="#FFFFFF"/>
      <text x="40" y="68" textAnchor="middle" fontSize="6.5" fontWeight="800" fill={dark?'#EAB308':'#1E3A8A'} fontFamily="system-ui,sans-serif" letterSpacing="1.2">PATIMO</text>
    </svg>
  );
}

function CardFront({ student, signature, logo, settings }) {
  const dob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const initials = `${student.firstName?.[0] || '?'}${student.lastName?.[0] || '?'}`.toUpperCase();
  const firstName = student.firstName || '';
  const middleName = student.middleName || '';
  const lastName = student.lastName || '';
  const finalLogo = logo || settings?.logoUrl;
  const finalSchoolName = settings?.schoolName || 'PATIMO COLLEGE';

  return (
    <div style={{ width: 320, height: 500, borderRadius: 14, overflow: 'hidden', position: 'relative', fontFamily: "'Inter', sans-serif", flexShrink: 0, background: '#FFFFFF', border: '1px solid #CBD5E1', boxShadow: '0 8px 32px rgba(15,23,42,0.12)' }}>

      {/* ── Watermark behind body ── */}
      <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', width: 200, height: 200, opacity: 0.035, pointerEvents: 'none', zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {finalLogo
          ? <img src={finalLogo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'grayscale(100%)' }} />
          : <Crest size={200} />}
      </div>

      {/* ── HEADER (Navy + gold accents) ── */}
      <div style={{ height: 82, background: '#0F172A', position: 'relative', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10 }}>
        {/* Gold accent stripe at left edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#EAB308' }} />
        {/* Gold corner triangle */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 60px 60px 0', borderColor: 'transparent #EAB308 transparent transparent' }} />
        {/* Diagonal white slash at bottom */}
        <div style={{ position: 'absolute', bottom: -1, left: '-5%', width: '110%', height: 18, background: '#FFFFFF', transform: 'skewY(-2.5deg)', transformOrigin: 'left bottom' }} />

        {/* Logo */}
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #EAB308', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', zIndex: 1 }}>
          {finalLogo
            ? <img src={finalLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <Crest size={28} dark />}
        </div>
        {/* School text */}
        <div style={{ zIndex: 1 }}>
          <div style={{ color: '#FFFFFF', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>{finalSchoolName}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.46rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>Virtue and Knowledge · Est. 2005</div>
        </div>
      </div>

      {/* ── BADGE (sits on the header/body seam) ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -6, position: 'relative', zIndex: 3 }}>
        <div style={{ background: '#EAB308', color: '#0F172A', fontSize: '0.48rem', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '4px 16px', borderRadius: 20, boxShadow: '0 2px 8px rgba(234,179,8,0.25)' }}>STUDENT IDENTITY CARD</div>
      </div>

      {/* ── PHOTO ── */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12, position: 'relative', zIndex: 2 }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', padding: 3, background: 'linear-gradient(135deg, #EAB308, #F59E0B)', boxShadow: '0 4px 14px rgba(234,179,8,0.25)' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', border: '2px solid #fff' }}>
            {student.photo ? <img src={student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
          </div>
        </div>
      </div>

      {/* ── NAME + CLASS ── */}
      <div style={{ textAlign: 'center', marginTop: 8, padding: '0 24px', position: 'relative', zIndex: 2 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.15 }}>{lastName}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748B', marginTop: 2 }}>{firstName}{middleName ? ` ${middleName}` : ''}</div>
        <div style={{ display: 'inline-block', marginTop: 5, background: '#0F172A', color: '#EAB308', fontSize: '0.52rem', fontWeight: 900, padding: '3px 14px', borderRadius: 20, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {student.currentClass?.name || '—'}
        </div>
      </div>

      {/* ── DETAILS GRID ── */}
      <div style={{ margin: '10px 18px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0', position: 'relative', zIndex: 2 }}>
        {[
          { label: 'ADMISSION NO',  value: student.admissionNo },
          { label: 'GENDER',        value: student.gender || '—' },
          { label: 'DATE OF BIRTH', value: dob },
          { label: 'BLOOD GROUP',   value: student.bloodGroup || '—', badge: true },
        ].map((row, i) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC', borderBottom: i < 3 ? '1px solid #F1F5F9' : 'none' }}>
            <span style={{ fontSize: '0.52rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.08em' }}>{row.label}</span>
            {row.badge
              ? <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#DC2626', background: '#FEF2F2', padding: '1px 8px', borderRadius: 6, border: '0.5px solid #FECACA' }}>{row.value}</span>
              : <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#0F172A' }}>{row.value}</span>}
          </div>
        ))}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 68, background: '#0F172A', borderTop: '3px solid #EAB308', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {signature
            ? <img src={signature} alt="signature" style={{ height: 22, maxWidth: 80, objectFit: 'contain', display: 'block', marginBottom: 2, filter: 'brightness(0) invert(1)' }} />
            : <div style={{ height: 22 }} />}
          <div style={{ width: 80, borderTop: '1px solid rgba(255,255,255,0.25)', marginTop: 2 }} />
          <div style={{ fontSize: '0.42rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Principal's Signature</div>
        </div>
        <QRCodeSVG value={`${student.admissionNo}|${firstName} ${lastName}`} size={40} level="M" fgColor="#EAB308" bgColor="transparent" />
      </div>

    </div>
  );
}

function CardBack({ student, settings }) {
  const finalLogo = settings?.logoUrl;
  const finalSchoolName = settings?.schoolName || 'PATIMO COLLEGE';

  return (
    <div style={{ width:320, height:500, borderRadius:16, overflow:'hidden', position:'relative', fontFamily:"'Inter', sans-serif", flexShrink:0, background:'#FFFFFF', border:'1px solid #E2E8F0', boxShadow:'0 15px 35px rgba(15,23,42,0.15)' }}>
      {/* Lanyard Cutout slot at the top */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10 }}>
        <div style={{ width: 44, height: 8, borderRadius: 4, background: '#0F172A', opacity: 0.15 }} />
      </div>

      {/* Background Logo/Crest Watermark */}
      <div style={{ position:'absolute', inset:'130px 0 0 0', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1, pointerEvents:'none', opacity:0.03 }}>
        {finalLogo ? (
          <img src={finalLogo} alt="" style={{ width: 180, height: 180, objectFit: 'contain', filter: 'grayscale(100%)' }} />
        ) : (
          <Crest size={220}/>
        )}
      </div>

      <div style={{ background:'#0F172A', height:8, borderBottom:'3px solid #EAB308', position:'relative', zIndex:2 }}/>

      <div style={{ position:'relative', zIndex:2, padding:'20px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>
            {finalLogo ? <img src={finalLogo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} /> : <Crest size={40}/>}
          </div>
          <div style={{ fontSize:'0.8rem', fontWeight:800, color:'#0F172A', letterSpacing:'0.05em', textTransform:'uppercase' }}>{finalSchoolName} INTERNATIONAL</div>
          <div style={{ fontSize:'0.55rem', color:'#64748B', marginTop:4, lineHeight:1.5 }}>
            KM 5, Onitsha–Owerri Road, Anambra State, Nigeria<br/>
            📞 +234 803 000 0000 &nbsp;·&nbsp; ✉ info@patimocollege.edu.ng<br/>
            <span style={{ color:'#1E3A8A', fontWeight:700 }}>🌐 www.patimocollege.edu.ng</span>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
          <div style={{ flex:1, height:1, background:'#E2E8F0' }}/>
          <span style={{ fontSize:'0.5rem', fontWeight:800, color:'#EAB308', letterSpacing:'0.1em', textTransform:'uppercase' }}>Rules & Regulations</span>
          <div style={{ flex:1, height:1, background:'#E2E8F0' }}/>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {[
            'This card must be worn visibly at all times within the school premises.',
            'Loss of this card must be reported immediately to the school administration.',
            'This card is non-transferable and remains the property of Patimo College.',
            'Tampering with this card will attract severe disciplinary action.',
            'Replacement fee: ₦1,000. Required for all official school functions.'
          ].map((rule,i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
              <div style={{ minWidth:16, height:16, borderRadius:'50%', background:'#0F172A', color:'#EAB308', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.5rem', fontWeight:800, marginTop:1, flexShrink:0 }}>{i+1}</div>
              <p style={{ fontSize:'0.55rem', color:'#334155', lineHeight:1.5, margin:0, fontWeight:500 }}>{rule}</p>
            </div>
          ))}
        </div>

        {student.parentPhone && (
          <div style={{ marginTop:14, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:6, padding:'6px 10px' }}>
            <div style={{ fontSize:'0.5rem', fontWeight:800, color:'#16A34A', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:1 }}>👨‍👩‍👧 Parent / Guardian Contact</div>
            <div style={{ fontSize:'0.65rem', fontWeight:700, color:'#15803D' }}>{student.parentPhone}</div>
          </div>
        )}
      </div>

      {/* Back Footer */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:40, background:'#0F172A', borderTop:'3px solid #EAB308', padding:'0 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:'0.55rem', color:'rgba(255,255,255,0.6)', fontWeight:600 }}>{student.admissionNo}</span>
        <span style={{ fontSize:'0.55rem', color:'#EAB308', fontWeight:700 }}>SESSION {student.session||CURRENT_SESSION}</span>
      </div>
    </div>
  );
}
export default function IDCardPage() {
  const [classId,  setClassId]  = useState('');
  const [search,   setSearch]   = useState('');
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [signature,setSignature]= useState(null);
  const [logo,     setLogo]     = useState(null);
  const [flipped,  setFlipped]  = useState({});
  const sigRef  = useRef();
  const logoRef = useRef();
  const printRef = useRef();

  const { data: classes = [] } = useQuery({
    queryKey:['classes'],
    queryFn: ()=>classService.getAll().then(r=>r.data.classes||r.data||[]),
    placeholderData:[{id:'c1',name:'JSS 1A'},{id:'c2',name:'SS 3A'}],
  });

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE' }
  });

  const loadFile = (e, setter) => {
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader(); reader.onload=ev=>setter(ev.target.result); reader.readAsDataURL(file);
  };

  const loadStudents = async (cid) => {
    setClassId(cid); setStudents([]); setFlipped({});
    if(!cid)return; setLoading(true);
    try { const r=await api.get(`/students?classId=${cid}`); setStudents(r.data.students?.length?r.data.students:DEMO); }
    catch { setStudents(DEMO); } finally { setLoading(false); }
  };

  const doSearch = async () => {
    if(!search.trim())return; setLoading(true);
    try { const r=await api.get(`/students?search=${search}`); setStudents(r.data.students?.length?r.data.students:DEMO); }
    catch { setStudents(DEMO); } finally { setLoading(false); }
  };

  const handlePrint = () => {
    const w=window.open('','_blank');
    w.document.write(`<html><head><title>ID Cards – Patimo College</title><style>body{margin:0;background:#fff;font-family:'Inter', sans-serif}.grid{display:flex;flex-wrap:wrap;gap:24px;padding:24px;justify-content:center}.pair{display:flex;gap:16px;page-break-inside:avoid;margin-bottom:24px}@media print{@page{size:A4;margin:10mm}}</style></head><body><div class="grid">${printRef.current.innerHTML}</div></body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close();},600);
  };

  return (
    <div style={{ minHeight:'100vh', position:'relative', overflow:'hidden', background:'#0F172A' }}>
      {/* High-Performance, Gorgeous CSS Gradient Mesh Background */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at 10% 20%, rgba(30,58,138,0.3) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(234,179,8,0.06) 0%, transparent 60%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:10, padding:'36px 28px' }}>
        <div style={{ marginBottom:28, textAlign:'center' }}>
          <h1 style={{ color:'#F8FAFC', fontSize:'1.8rem', fontWeight:800, margin:0, letterSpacing:'-0.02em' }}>🪪 ID Card Generator</h1>
          <p style={{ color:'#EAB308', fontSize:'0.85rem', marginTop:6, letterSpacing:'0.04em', fontWeight:600 }}>Patimo College International · Generate &amp; Print Student ID Cards</p>
        </div>

        {/* Controls */}
        <div style={{ background:'rgba(15,23,42,0.6)', backdropFilter:'blur(20px)', border:'1px solid rgba(234,179,8,0.2)', borderRadius:16, padding:'20px 24px', marginBottom:22, display:'flex', flexWrap:'wrap', gap:14, alignItems:'flex-end' }}>
          <div style={{ flex:'1 1 160px' }}>
            <label style={{ color:'#94A3B8', fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Class</label>
            <select value={classId} onChange={e=>loadStudents(e.target.value)} style={{ width:'100%', background:'#1E293B', border:'1px solid rgba(234,179,8,0.3)', borderRadius:8, padding:'9px 12px', color:'#F1F5F9', fontSize:'0.85rem' }}>
              <option value="">Choose class…</option>
              {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ flex:'1 1 200px' }}>
            <label style={{ color:'#94A3B8', fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Search</label>
            <div style={{ display:'flex', gap:6 }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Name or admission no…" style={{ flex:1, background:'#1E293B', border:'1px solid rgba(234,179,8,0.3)', borderRadius:8, padding:'9px 12px', color:'#F1F5F9', fontSize:'0.85rem' }}/>
              <button onClick={doSearch} style={{ background:'rgba(234,179,8,0.15)', color:'#F59E0B', border:'1px solid rgba(234,179,8,0.3)', borderRadius:8, padding:'9px 14px', cursor:'pointer', fontSize:'0.8rem', fontWeight:800 }}>Go</button>
            </div>
          </div>

          <div>
            <label style={{ color:'#94A3B8', fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>School Logo</label>
            <button onClick={()=>logoRef.current.click()} style={{ background:logo?'rgba(22,163,74,0.2)':'#1E293B', color:logo?'#4ADE80':'#93C5FD', border:`1px solid ${logo?'rgba(74,222,128,0.4)':'rgba(234,179,8,0.3)'}`, borderRadius:8, padding:'9px 14px', cursor:'pointer', fontSize:'0.75rem', fontWeight:800 }}>
              {logo?'✓ Logo Set':'📁 Upload Logo'}
            </button>
            <input ref={logoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>loadFile(e,setLogo)}/>
          </div>

          <div>
            <label style={{ color:'#94A3B8', fontSize:'0.65rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:6 }}>Authorized Signature</label>
            <button onClick={()=>sigRef.current.click()} style={{ background:signature?'rgba(22,163,74,0.2)':'#1E293B', color:signature?'#4ADE80':'#93C5FD', border:`1px solid ${signature?'rgba(74,222,128,0.4)':'rgba(234,179,8,0.3)'}`, borderRadius:8, padding:'9px 14px', cursor:'pointer', fontSize:'0.75rem', fontWeight:800 }}>
              {signature?'✓ Signature Set':'✍️ Upload Signature'}
            </button>
            <input ref={sigRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>loadFile(e,setSignature)}/>
          </div>

          {students.length>0&&(
            <button onClick={handlePrint} style={{ background:'linear-gradient(135deg,#1E3A8A,#2563EB)', color:'#FFFFFF', border:'1px solid #3B82F6', borderRadius:8, padding:'9px 20px', cursor:'pointer', fontSize:'0.82rem', fontWeight:800, letterSpacing:'0.06em', boxShadow:'0 4px 14px rgba(37,99,235,0.3)' }}>
              🖨 Print {students.length} Cards
            </button>
          )}
        </div>

        {/* Signature preview */}
        {signature&&(
          <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(201,149,42,0.2)', borderRadius:10, padding:'8px 16px', marginBottom:18, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ color:'#94A3B8', fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Signature preview:</span>
            <img src={signature} alt="sig" style={{ height:30, maxWidth:140, objectFit:'contain', background:'white', padding:'2px 8px', borderRadius:4 }}/>
            <span style={{ color:'#4ADE80', fontSize:'0.62rem', fontWeight:700 }}>✓ Will appear on all cards</span>
          </div>
        )}

        {students.length>0&&(
          <p style={{ color:'rgba(201,149,42,0.65)', fontSize:'0.68rem', marginBottom:20, textAlign:'center', letterSpacing:'0.04em' }}>
            ✨ Click any card to flip and see the back side
          </p>
        )}

        {loading&&(
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ width:38, height:38, border:'3px solid rgba(201,149,42,0.2)', borderTopColor:'#C9952A', borderRadius:'50%', margin:'0 auto 14px', animation:'spin 0.8s linear infinite' }}/>
            <p style={{ color:'#64748B', fontSize:'0.82rem' }}>Loading students…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {!loading&&students.length===0&&(
          <div style={{ textAlign:'center', padding:80, color:'#475569' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>🪪</div>
            <h3 style={{ color:'#94A3B8', marginBottom:6, fontWeight:700 }}>No Students Loaded</h3>
            <p style={{ fontSize:'0.82rem' }}>Select a class or search for a student to generate ID cards.</p>
          </div>
        )}

        {!loading&&students.length>0&&(
          <div style={{ display:'flex', flexWrap:'wrap', gap:36, justifyContent:'center' }}>
            {students.map(s=>(
              <div key={s.id} onClick={()=>setFlipped(f=>({...f,[s.id]:!f[s.id]}))} style={{ cursor:'pointer', perspective:1200 }}>
                <div style={{ transition:'transform 0.7s cubic-bezier(0.4,0,0.2,1)', transformStyle:'preserve-3d', transform:flipped[s.id]?'rotateY(180deg)':'rotateY(0)', position:'relative', width:310, height:505 }}>
                  <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden' }}><CardFront student={s} signature={signature} logo={logo} settings={settings}/></div>
                  <div style={{ position:'absolute', inset:0, backfaceVisibility:'hidden', transform:'rotateY(180deg)' }}><CardBack student={s} settings={settings}/></div>
                </div>
                <p style={{ color:'rgba(201,149,42,0.6)', fontSize:'0.62rem', textAlign:'center', marginTop:10, letterSpacing:'0.06em' }}>
                  {flipped[s.id]?'← Back':'Front →'} · tap to flip
                </p>
              </div>
            ))}
          </div>
        )}

        <div ref={printRef} style={{ display:'none' }}>
          {students.map(s=>(
            <div key={s.id} className="pair">
              <CardFront student={s} signature={signature} logo={logo} settings={settings}/>
              <CardBack student={s} settings={settings}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

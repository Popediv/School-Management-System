import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const TERMS = [
  { value:'FIRST',  label:'First Term'  },
  { value:'SECOND', label:'Second Term' },
  { value:'THIRD',  label:'Third Term'  },
];
const NOW  = new Date();
const MO   = NOW.getMonth() + 1;
const YR   = MO >= 9 ? NOW.getFullYear() : NOW.getFullYear() - 1;
const DEF_SESSION = `${YR}/${YR+1}`;
const DEF_TERM    = MO >= 9 ? 'FIRST' : MO >= 5 ? 'THIRD' : 'SECOND';
const SESSIONS    = [`${YR-1}/${YR}`, DEF_SESSION, `${YR+1}/${YR+2}`];

const GC = { A:'#15803d',B:'#1d4ed8',C:'#92400e',D:'#c2410c',E:'#7e22ce',F:'#b91c1c' };
const GB = { A:'#dcfce7',B:'#dbeafe',C:'#fef3c7',D:'#ffedd5',E:'#f3e8ff',F:'#fee2e2' };

function gradeColor(g){ return GC[g]||'#374151'; }
function gradeBg(g)   { return GB[g]||'#f3f4f6'; }
function overallGrade(a){ if(!a)return'—'; if(a>=75)return'A'; if(a>=65)return'B'; if(a>=55)return'C'; if(a>=45)return'D'; if(a>=40)return'E'; return'F'; }
function autoRemark(a){
  if(!a)return'';
  if(a>=75)return'An outstanding performance. This student demonstrates excellent mastery across all subjects. Keep up the exceptional work!';
  if(a>=65)return'A very commendable result. With focused effort and dedication, even greater heights are well within reach.';
  if(a>=55)return'A satisfactory performance. The student should dedicate more time to weaker subjects for continued improvement.';
  if(a>=45)return'A fair result. Greater diligence and consistent study habits are strongly encouraged going forward.';
  if(a>=40)return'Performance is below expectation. Parents and guardians are advised to provide closer academic support at home.';
  return'An unsatisfactory performance. Urgent improvement is required. The student must dedicate significant effort next term.';
}

function SchoolCrest({ size=70 }){
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="37" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <rect x="22" y="28" width="36" height="24" rx="3" fill="rgba(255,255,255,0.9)"/>
      <rect x="22" y="28" width="18" height="24" rx="2" fill="#F0C85A" opacity="0.9"/>
      <line x1="40" y1="28" x2="40" y2="52" stroke="white" strokeWidth="2"/>
      <rect x="37" y="14" width="6" height="16" rx="2" fill="#F0C85A"/>
      <ellipse cx="40" cy="12" rx="6" ry="7" fill="#F0C85A" opacity="0.9"/>
      <circle cx="25" cy="22" r="2.5" fill="#F0C85A"/>
      <circle cx="55" cy="22" r="2.5" fill="#F0C85A"/>
      <text x="40" y="70" textAnchor="middle" fontSize="7" fontWeight="800" fill="white" fontFamily="Georgia,serif" letterSpacing="1">PATIMO</text>
    </svg>
  );
}

export default function ReportCardPage(){
  const { studentId: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isStudent = user?.role==='STUDENT';
  const studentId = paramId || searchParams.get('studentId') || '';
  const [session, setSession] = useState(DEF_SESSION);
  const [term,    setTerm]    = useState(DEF_TERM);

  const { data, isLoading, isError } = useQuery({
    queryKey:['report-card', studentId||'me', session, term],
    queryFn: ()=> api.get(`/results/report-card/${studentId||'me'}`,{params:{session,term}}).then(r=>r.data),
    enabled: isStudent ? true : !!studentId,
  });

  const { data: school } = useQuery({
    queryKey:['school-settings'],
    queryFn: ()=> api.get('/settings/school').then(r=>r.data),
    staleTime:Infinity,
  });

  const { student, results=[], summary={} } = data||{};
  const avg = parseFloat(summary.average)||(results.length ? results.reduce((s,r)=>s+(r.total||0),0)/results.length : 0);
  const termLabel   = TERMS.find(t=>t.value===term)?.label||term;
  const schoolName  = school?.name      ||'Patimo College International';
  const schoolAddr  = school?.address   ||'KM 5, Onitsha–Owerri Road, Anambra State, Nigeria';
  const schoolPhone = school?.phone     ||'+234 803 000 0000';
  const schoolEmail = school?.email     ||'info@patimocollege.edu.ng';
  const schoolLogo  = school?.logoUrl   ||null;
  const schoolMotto = school?.motto     ||'"Excellence · Integrity · Service"';
  const og = overallGrade(avg);

  const handlePrint = () => {
    const card = document.getElementById('rc-card');
    if (!card) return;
    const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
      .map(el => el.outerHTML).join('\n');
    const w = window.open('', '_blank', 'width=960,height=1200');
    w.document.write(`<!DOCTYPE html><html><head>
<title>Report Card – ${student?.firstName||''} ${student?.lastName||''}</title>
<meta charset="UTF-8"/>${styles}
<style>
@page{size:A4 portrait;margin:5mm 7mm;}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box!important;}
body{margin:0;padding:0;background:#fff;}
#rc-card{max-width:100%!important;border-radius:0!important;box-shadow:none!important;}
.rc-header-inner{padding:9px 16px 7px!important;gap:12px!important;}
.rc-logo-ring{width:50px!important;height:50px!important;}
.rc-school-name{font-size:16px!important;}.rc-school-meta{font-size:8.5px!important;line-height:1.45!important;}
.rc-school-motto{font-size:8px!important;}.rc-badge{padding:7px 10px!important;min-width:100px!important;}
.rc-badge-eyebrow{font-size:6.5px!important;}.rc-badge-term{font-size:12px!important;}.rc-badge-session{font-size:8.5px!important;}
.rc-ribbon{height:3px!important;}.rc-rainbow{height:2px!important;}
.rc-body{padding:6px 14px 4px!important;background:#FAFAFA!important;}
.rc-sh{margin:6px 0 4px!important;font-size:7.5px!important;}.rc-sh-dot{width:4px!important;height:4px!important;}
.rc-igrid{border-radius:5px!important;}.rc-icell{padding:4px 9px!important;}
.rc-ilabel{font-size:7px!important;margin-bottom:1px!important;}.rc-ivalue{font-size:9.5px!important;}
.rc-gkey{border-radius:5px!important;}.rc-gki{padding:4px 3px!important;}
.rc-gki-letter{font-size:13px!important;}.rc-gki-range{font-size:7.5px!important;}.rc-gki-label{font-size:7px!important;}
.rc-table-wrap{border-radius:5px!important;}.rc-table{font-size:8.5px!important;}
.rc-table th{padding:4px 7px!important;font-size:7px!important;}.rc-table td{padding:3px 7px!important;}
.rc-sn{font-size:8.5px!important;}.rc-total{font-size:10px!important;}.rc-gpill{width:18px!important;height:18px!important;font-size:8px!important;}
.rc-sumgrid{gap:5px!important;}.rc-sumcard{padding:6px 7px!important;border-radius:6px!important;}
.rc-sumcard::before{height:2px!important;}.rc-suml{font-size:7px!important;margin-bottom:2px!important;}.rc-sumv{font-size:16px!important;}
.rc-attgrid{gap:5px!important;}.rc-attpill{padding:5px 6px!important;border-radius:6px!important;}
.rc-attv{font-size:13px!important;}.rc-attl{font-size:7.5px!important;margin-top:0!important;}
.rc-rbox{padding:5px 10px!important;margin-bottom:4px!important;border-radius:6px!important;}
.rc-rlabel{font-size:7px!important;margin-bottom:3px!important;}
.rc-rtext{font-size:8.5px!important;line-height:1.4!important;padding:3px 0!important;min-height:18px!important;}
.rc-nextgrid{gap:5px!important;}.rc-nextcard{padding:5px 9px!important;border-radius:6px!important;}
.rc-nextl{font-size:7px!important;margin-bottom:1px!important;}.rc-nextv{font-size:10px!important;}
.rc-signgrid{gap:14px!important;margin-top:7px!important;}.rc-signgap{height:24px!important;}
.rc-signtitle{font-size:8.5px!important;}.rc-signrole{font-size:7.5px!important;}
.rc-footer{margin-top:5px!important;padding-top:4px!important;font-size:7.5px!important;}
.rc-footer-stamp{font-size:7px!important;padding:2px 6px!important;}
*{page-break-inside:avoid!important;}
</style>
</head><body>${card.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(()=>{w.print();},900);
  };

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');

      .rc-root { font-family:'Inter',sans-serif; background:#0F172A; min-height:100vh; padding:28px 20px; }

      /* toolbar */
      .rc-toolbar { max-width:900px; margin:0 auto 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
      .rc-back    { display:flex; align-items:center; gap:6px; color:#94A3B8; text-decoration:none; font-size:13px; transition:color .15s; }
      .rc-back:hover { color:#F1F5F9; }
      .rc-title   { font-size:20px; font-weight:700; color:#F1F5F9; margin:0 0 2px; }
      .rc-subtitle{ font-size:13px; color:#64748B; margin:0; }
      .rc-controls{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .rc-sel     { background:#1E293B; border:1px solid #334155; color:#F1F5F9; padding:8px 32px 8px 12px; border-radius:8px; font-size:13px; font-family:inherit; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
      .rc-sel:focus{ outline:none; border-color:#3B82F6; }
      .rc-pbtn    { display:flex; align-items:center; gap:7px; padding:9px 18px; background:linear-gradient(135deg,#1d4ed8,#1e40af); color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:opacity .15s; }
      .rc-pbtn:hover { opacity:.88; }
      .rc-pbtn:disabled{ opacity:.4; cursor:not-allowed; }

      /* card */
      #rc-card {
        max-width:900px; margin:0 auto;
        background:#FFFFFF;
        border-radius:20px;
        overflow:hidden;
        box-shadow:0 40px 100px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.3);
      }

      /* === HEADER === */
      .rc-header {
        background:linear-gradient(135deg, #0B1F4B 0%, #1A3571 45%, #0D47A1 75%, #0B3D91 100%);
        padding:0;
        position:relative;
        overflow:hidden;
      }
      .rc-header-bg1 { position:absolute; width:380px; height:380px; border-radius:50%; background:rgba(255,255,255,0.04); top:-180px; right:-100px; pointer-events:none; }
      .rc-header-bg2 { position:absolute; width:220px; height:220px; border-radius:50%; background:rgba(255,255,255,0.03); bottom:-100px; left:40%; pointer-events:none; }
      .rc-header-bg3 { position:absolute; inset:0; background:radial-gradient(ellipse at 80% 50%, rgba(201,149,42,0.12) 0%, transparent 60%); pointer-events:none; }

      .rc-header-inner { position:relative; z-index:2; padding:28px 36px 22px; display:flex; align-items:center; gap:24px; }

      .rc-logo-ring {
        width:82px; height:82px; border-radius:50%; flex-shrink:0;
        border:3px solid rgba(240,200,90,0.6);
        box-shadow:0 0 0 6px rgba(240,200,90,0.1), 0 8px 32px rgba(0,0,0,0.3);
        overflow:hidden; background:rgba(255,255,255,0.08);
        display:flex; align-items:center; justify-content:center;
      }
      .rc-logo-ring img { width:100%; height:100%; object-fit:cover; }

      .rc-school-block { flex:1; min-width:0; }
      .rc-school-name  { font-family:'Playfair Display',serif; font-size:26px; font-weight:800; color:#FFFFFF; line-height:1.1; margin:0 0 4px; }
      .rc-school-meta  { font-size:11.5px; color:rgba(255,255,255,0.65); line-height:1.8; margin:0; }
      .rc-school-motto { font-style:italic; color:rgba(240,200,90,0.8); font-size:11px; margin-top:4px; }

      .rc-badge {
        flex-shrink:0;
        background:rgba(255,255,255,0.08);
        border:1px solid rgba(240,200,90,0.3);
        border-radius:14px; padding:14px 20px; text-align:center;
        backdrop-filter:blur(10px);
        min-width:140px;
      }
      .rc-badge-eyebrow { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:rgba(255,255,255,0.5); margin-bottom:4px; }
      .rc-badge-term    { font-size:18px; font-weight:800; color:#FFFFFF; line-height:1.1; }
      .rc-badge-session { font-size:12px; color:rgba(240,200,90,0.8); margin-top:3px; font-weight:600; }

      /* gold ribbon */
      .rc-ribbon { height:6px; background:linear-gradient(90deg, #C9952A 0%, #F0C85A 30%, #C9952A 50%, #F0C85A 70%, #C9952A 100%); }
      /* rainbow stripe */
      .rc-rainbow { height:4px; background:linear-gradient(90deg,#EF4444,#F97316,#EAB308,#22C55E,#3B82F6,#8B5CF6,#EC4899); }

      /* === BODY === */
      .rc-body { padding:32px 36px; background:#FAFAFA; }

      /* section heading */
      .rc-sh {
        display:flex; align-items:center; gap:10px;
        font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:#94A3B8;
        margin:28px 0 12px;
      }
      .rc-sh-dot { width:6px; height:6px; border-radius:50%; background:#C9952A; flex-shrink:0; }
      .rc-sh::after { content:''; flex:1; height:1px; background:linear-gradient(to right, #E2E8F0, transparent); }

      /* student info grid */
      .rc-igrid {
        display:grid; grid-template-columns:1fr 1fr;
        border-radius:14px; overflow:hidden;
        border:1px solid #E2E8F0;
        box-shadow:0 2px 8px rgba(0,0,0,0.04);
      }
      .rc-icell { padding:13px 18px; border-bottom:1px solid #EEF2F7; border-right:1px solid #EEF2F7; background:#FFFFFF; }
      .rc-icell:nth-child(even)      { border-right:none; }
      .rc-icell:nth-last-child(-n+2) { border-bottom:none; }
      .rc-ilabel { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#94A3B8; margin-bottom:4px; }
      .rc-ivalue { font-size:14px; font-weight:600; color:#0F172A; }

      /* grading key */
      .rc-gkey { display:grid; grid-template-columns:repeat(6,1fr); border-radius:14px; overflow:hidden; border:1px solid #E2E8F0; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .rc-gki   { padding:12px 6px; text-align:center; border-right:1px solid #EEF2F7; background:#FFFFFF; }
      .rc-gki:last-child { border-right:none; }
      .rc-gki-letter { font-size:22px; font-weight:800; line-height:1; }
      .rc-gki-range  { font-size:10.5px; color:#64748B; margin-top:3px; font-weight:500; }
      .rc-gki-label  { font-size:9.5px; color:#94A3B8; margin-top:2px; }

      /* results table */
      .rc-table-wrap { border-radius:14px; overflow:hidden; border:1px solid #E2E8F0; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .rc-table { width:100%; border-collapse:collapse; font-size:13px; background:#FFFFFF; }
      .rc-table thead tr { background:linear-gradient(135deg,#0B1F4B,#1A3571); }
      .rc-table th { padding:11px 14px; font-size:10px; text-transform:uppercase; letter-spacing:.09em; color:rgba(255,255,255,0.7); font-weight:700; text-align:left; white-space:nowrap; }
      .rc-table th.c, .rc-table td.c { text-align:center; }
      .rc-table tbody tr { transition:background .1s; }
      .rc-table tbody tr:nth-child(even) td { background:#F8FAFC; }
      .rc-table td { padding:10px 14px; border-bottom:1px solid #F1F5F9; color:#334155; vertical-align:middle; }
      .rc-table tbody tr:last-child td { border-bottom:none; }
      .rc-sn    { font-weight:700; color:#0F172A; font-size:13.5px; }
      .rc-total { font-weight:800; font-size:16px; }
      .rc-gpill { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; font-weight:800; font-size:13px; }

      /* summary cards */
      .rc-sumgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
      .rc-sumcard {
        background:#FFFFFF; border:1px solid #E2E8F0;
        border-radius:14px; padding:16px;
        text-align:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.04);
        position:relative; overflow:hidden;
      }
      .rc-sumcard::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
      .rc-sumcard.blue::before  { background:#3B82F6; }
      .rc-sumcard.navy::before  { background:#0B1F4B; }
      .rc-sumcard.gold::before  { background:#C9952A; }
      .rc-sumcard.grade::before { background:var(--gc); }
      .rc-suml { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#94A3B8; margin-bottom:6px; }
      .rc-sumv { font-size:26px; font-weight:800; }

      /* attendance row */
      .rc-attgrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
      .rc-attpill { background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; padding:14px 12px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .rc-attv { font-size:22px; font-weight:800; }
      .rc-attl { font-size:10px; color:#64748B; margin-top:3px; font-weight:500; }

      /* remarks */
      .rc-rbox { background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; padding:16px 20px; margin-bottom:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .rc-rlabel { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#94A3B8; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
      .rc-rlabel::before { content:''; width:4px; height:4px; border-radius:50%; background:#C9952A; }
      .rc-rtext  { min-height:40px; font-size:13.5px; color:#374151; line-height:1.7; padding:8px 0; border-top:1px dashed #E2E8F0; }

      /* next term */
      .rc-nextgrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .rc-nextcard { background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; padding:14px 18px; box-shadow:0 2px 8px rgba(0,0,0,0.04); }
      .rc-nextl { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:#94A3B8; margin-bottom:5px; }
      .rc-nextv { font-size:15px; font-weight:700; color:#0F172A; }

      /* signatures */
      .rc-signgrid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; margin-top:32px; }
      .rc-signbox  { text-align:center; }
      .rc-signgap  { height:52px; }
      .rc-signline { border-top:2px solid #0B1F4B; margin-bottom:7px; }
      .rc-signtitle{ font-size:12.5px; font-weight:700; color:#0F172A; }
      .rc-signrole { font-size:11px; color:#64748B; margin-top:2px; }

      /* footer */
      .rc-footer { margin-top:28px; padding:14px 0 0; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:#94A3B8; }
      .rc-footer-stamp { background:linear-gradient(135deg,#0B1F4B,#1A3571); color:rgba(255,255,255,0.7); padding:4px 12px; border-radius:20px; font-size:10px; font-weight:600; letter-spacing:.06em; }

      /* watermark on card body */
      .rc-watermark {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        pointer-events:none; z-index:0;
      }
      .rc-body-wrap { position:relative; }

      /* ── PRINT — single A4 page ── */
      @media print {
        @page { size:A4 portrait; margin:5mm 7mm; }
        * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; box-sizing:border-box !important; }
        .rc-root    { background:#fff !important; padding:0 !important; min-height:unset !important; }
        .rc-toolbar { display:none !important; }
        #rc-card    { max-width:100% !important; width:100% !important; border-radius:0 !important; box-shadow:none !important; margin:0 !important; border:none !important; }
        /* header compact */
        .rc-header-inner { padding:9px 16px 7px !important; gap:12px !important; }
        .rc-logo-ring    { width:50px !important; height:50px !important; }
        .rc-school-name  { font-size:16px !important; margin-bottom:1px !important; }
        .rc-school-meta  { font-size:8.5px !important; line-height:1.45 !important; }
        .rc-school-motto { font-size:8px !important; margin-top:1px !important; }
        .rc-badge        { padding:7px 10px !important; min-width:100px !important; border-radius:7px !important; }
        .rc-badge-eyebrow{ font-size:6.5px !important; }
        .rc-badge-term   { font-size:12px !important; }
        .rc-badge-session{ font-size:8.5px !important; }
        .rc-ribbon       { height:3px !important; }
        .rc-rainbow      { height:2px !important; }
        /* body compact */
        .rc-body  { padding:6px 14px 4px !important; background:#FAFAFA !important; }
        .rc-sh    { margin:6px 0 4px !important; font-size:7.5px !important; }
        .rc-sh-dot{ width:4px !important; height:4px !important; }
        /* info grid */
        .rc-igrid  { border-radius:5px !important; }
        .rc-icell  { padding:4px 9px !important; }
        .rc-ilabel { font-size:7px !important; margin-bottom:1px !important; }
        .rc-ivalue { font-size:9.5px !important; }
        /* grading key */
        .rc-gkey       { border-radius:5px !important; }
        .rc-gki        { padding:4px 3px !important; }
        .rc-gki-letter { font-size:13px !important; }
        .rc-gki-range  { font-size:7.5px !important; margin-top:1px !important; }
        .rc-gki-label  { font-size:7px !important; margin-top:0 !important; }
        /* table */
        .rc-table-wrap { border-radius:5px !important; }
        .rc-table      { font-size:8.5px !important; }
        .rc-table th   { padding:4px 7px !important; font-size:7px !important; }
        .rc-table td   { padding:3px 7px !important; }
        .rc-sn         { font-size:8.5px !important; }
        .rc-total      { font-size:10px !important; }
        .rc-gpill      { width:18px !important; height:18px !important; font-size:8px !important; }
        /* summary */
        .rc-sumgrid  { gap:5px !important; }
        .rc-sumcard  { padding:6px 7px !important; border-radius:6px !important; }
        .rc-sumcard::before { height:2px !important; }
        .rc-suml     { font-size:7px !important; margin-bottom:2px !important; }
        .rc-sumv     { font-size:16px !important; }
        /* attendance */
        .rc-attgrid  { gap:5px !important; }
        .rc-attpill  { padding:5px 6px !important; border-radius:6px !important; }
        .rc-attv     { font-size:13px !important; }
        .rc-attl     { font-size:7.5px !important; margin-top:0 !important; }
        /* remarks */
        .rc-rbox   { padding:5px 10px !important; margin-bottom:4px !important; border-radius:6px !important; }
        .rc-rlabel { font-size:7px !important; margin-bottom:3px !important; }
        .rc-rtext  { font-size:8.5px !important; line-height:1.4 !important; padding:3px 0 !important; min-height:18px !important; }
        /* next term */
        .rc-nextgrid { gap:5px !important; }
        .rc-nextcard { padding:5px 9px !important; border-radius:6px !important; }
        .rc-nextl    { font-size:7px !important; margin-bottom:1px !important; }
        .rc-nextv    { font-size:10px !important; }
        /* signatures */
        .rc-signgrid { gap:14px !important; margin-top:7px !important; }
        .rc-signgap  { height:24px !important; }
        .rc-signtitle{ font-size:8.5px !important; }
        .rc-signrole { font-size:7.5px !important; }
        /* footer */
        .rc-footer       { margin-top:5px !important; padding-top:4px !important; font-size:7.5px !important; }
        .rc-footer-stamp { font-size:7px !important; padding:2px 6px !important; }
        /* no page breaks */
        * { page-break-inside:avoid !important; }
        html, body { height:auto !important; overflow:visible !important; }
      }
    `}</style>

    <div className="rc-root">
      {/* Toolbar */}
      <div className="rc-toolbar">
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <Link to={studentId?`/students/${studentId}`:'/students'} className="rc-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </Link>
          <div>
            <p className="rc-title">Student Report Card</p>
            <p className="rc-subtitle">{student ? `${student.firstName} ${student.lastName} · ${termLabel} ${session}` : 'Select a student and term'}</p>
          </div>
        </div>
        <div className="rc-controls">
          <select className="rc-sel" value={session} onChange={e=>setSession(e.target.value)}>
            {SESSIONS.map(s=><option key={s} value={s}>{s} Session</option>)}
          </select>
          <select className="rc-sel" value={term} onChange={e=>setTerm(e.target.value)}>
            {TERMS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button className="rc-pbtn" onClick={handlePrint} disabled={!data||isLoading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* States */}
      {isLoading&&(
        <div style={{ textAlign:'center', padding:72, color:'#64748B' }}>
          <div style={{ width:38,height:38,border:'3px solid #1E293B',borderTopColor:'#3B82F6',borderRadius:'50%',animation:'rcspin .8s linear infinite',margin:'0 auto 14px' }}/>
          <style>{`@keyframes rcspin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ fontSize:14 }}>Loading report card…</p>
        </div>
      )}
      {isError&&(
        <div style={{ maxWidth:900,margin:'0 auto',background:'#FEF2F2',border:'1px solid #FECACA',color:'#B91C1C',padding:'14px 18px',borderRadius:12,fontSize:14 }}>
          Failed to load report card. Please ensure results have been uploaded for this term and session.
        </div>
      )}
      {!isStudent&&!studentId&&!isLoading&&(
        <div style={{ maxWidth:900,margin:'0 auto',textAlign:'center',padding:72,color:'#64748B',border:'2px dashed #1E293B',borderRadius:16,fontSize:14 }}>
          <div style={{ fontSize:52,marginBottom:14 }}>📄</div>
          <h3 style={{ color:'#94A3B8',marginBottom:6,fontWeight:700 }}>No student selected</h3>
          <p>Open from a student's profile page, or add <code style={{ background:'#1E293B',color:'#93C5FD',padding:'2px 8px',borderRadius:4 }}>?studentId=ID</code> to the URL.</p>
        </div>
      )}

      {/* ══ REPORT CARD ══ */}
      {data&&student&&(
        <div className="rc-print-root" style={{ display:'block' }}>
        <div id="rc-card">

          {/* Header */}
          <div className="rc-header">
            <div className="rc-header-bg1"/>
            <div className="rc-header-bg2"/>
            <div className="rc-header-bg3"/>
            <div className="rc-header-inner">
              <div className="rc-logo-ring">
                {schoolLogo ? <img src={schoolLogo} alt="logo"/> : <SchoolCrest size={70}/>}
              </div>
              <div className="rc-school-block">
                <h1 className="rc-school-name">{schoolName}</h1>
                <p className="rc-school-meta">
                  {schoolAddr}<br/>
                  Tel: {schoolPhone} &nbsp;·&nbsp; Email: {schoolEmail}
                </p>
                <p className="rc-school-motto">{schoolMotto}</p>
              </div>
              <div className="rc-badge">
                <div className="rc-badge-eyebrow">Academic Report</div>
                <div className="rc-badge-term">{termLabel}</div>
                <div className="rc-badge-session">{session} Session</div>
              </div>
            </div>
          </div>
          <div className="rc-ribbon"/>
          <div className="rc-rainbow"/>

          {/* Body */}
          <div className="rc-body">

            {/* Student info */}
            <div className="rc-sh"><span className="rc-sh-dot"/>Student Information</div>
            <div className="rc-igrid">
              {[
                ['Student Name',     `${student.firstName}${student.middleName?' '+student.middleName:''} ${student.lastName}`],
                ['Admission No.',    student.admissionNo],
                ['Class',            student.currentClass?.name||'—'],
                ['Academic Session', session],
                ['Term',             termLabel],
                ['Gender',           student.gender ? student.gender.charAt(0).toUpperCase()+student.gender.slice(1).toLowerCase() : '—'],
                ['Date of Birth',    student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : '—'],
                ['Date Printed',     NOW.toLocaleDateString('en-GB')],
              ].map(([l,v])=>(
                <div key={l} className="rc-icell">
                  <div className="rc-ilabel">{l}</div>
                  <div className="rc-ivalue">{v}</div>
                </div>
              ))}
            </div>

            {/* Grading key */}
            <div className="rc-sh"><span className="rc-sh-dot"/>Grading Scale</div>
            <div className="rc-gkey">
              {[{g:'A',r:'75–100',l:'Excellent'},{g:'B',r:'65–74',l:'Very Good'},{g:'C',r:'55–64',l:'Good'},{g:'D',r:'45–54',l:'Pass'},{g:'E',r:'40–44',l:'Poor'},{g:'F',r:'0–39',l:'Fail'}].map(({g,r,l})=>(
                <div key={g} className="rc-gki">
                  <div className="rc-gki-letter" style={{ color:gradeColor(g) }}>{g}</div>
                  <div className="rc-gki-range">{r}</div>
                  <div className="rc-gki-label">{l}</div>
                </div>
              ))}
            </div>

            {/* Results */}
            <div className="rc-sh"><span className="rc-sh-dot"/>Academic Performance</div>
            {results.length>0 ? (
              <div className="rc-table-wrap">
                <table className="rc-table">
                  <thead>
                    <tr>
                      <th style={{ width:32 }}>#</th>
                      <th>Subject</th>
                      <th className="c">CA<span style={{ opacity:.45,fontWeight:400 }}> /40</span></th>
                      <th className="c">Exam<span style={{ opacity:.45,fontWeight:400 }}> /60</span></th>
                      <th className="c">Total<span style={{ opacity:.45,fontWeight:400 }}> /100</span></th>
                      <th className="c">Grade</th>
                      <th className="c">Position</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r,i)=>(
                      <tr key={r.id||i}>
                        <td style={{ color:'#94A3B8',fontSize:11 }}>{i+1}</td>
                        <td className="rc-sn">{r.subject?.name||r.subject}</td>
                        <td className="c">{r.caScore??r.ca??'—'}</td>
                        <td className="c">{r.examScore??r.exam??'—'}</td>
                        <td className="c rc-total" style={{ color:gradeColor(r.grade) }}>{r.total}</td>
                        <td className="c">
                          <span className="rc-gpill" style={{ background:gradeBg(r.grade), color:gradeColor(r.grade) }}>{r.grade}</span>
                        </td>
                        <td className="c" style={{ color:'#64748B',fontWeight:600 }}>{r.position??'—'}</td>
                        <td style={{ color:'#64748B',fontSize:12 }}>{r.remark||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):(
              <div style={{ textAlign:'center',padding:32,color:'#94A3B8',border:'2px dashed #E2E8F0',borderRadius:14,fontSize:13 }}>
                No results recorded for {termLabel} {session}.
              </div>
            )}

            {/* Summary */}
            <div className="rc-sh" style={{ marginTop:20 }}><span className="rc-sh-dot"/>Performance Summary</div>
            <div className="rc-sumgrid">
              <div className="rc-sumcard blue">
                <div className="rc-suml">Total Subjects</div>
                <div className="rc-sumv" style={{ color:'#3B82F6' }}>{results.length}</div>
              </div>
              <div className="rc-sumcard navy">
                <div className="rc-suml">Total Score</div>
                <div className="rc-sumv" style={{ color:'#0B1F4B' }}>{results.reduce((s,r)=>s+(r.total||0),0)}</div>
              </div>
              <div className="rc-sumcard gold">
                <div className="rc-suml">Average Score</div>
                <div className="rc-sumv" style={{ color:'#C9952A' }}>{avg?avg.toFixed(1):'—'}</div>
              </div>
              <div className="rc-sumcard grade" style={{ '--gc':gradeColor(og) }}>
                <div className="rc-suml">Overall Grade</div>
                <div className="rc-sumv" style={{ color:gradeColor(og) }}>{og}</div>
              </div>
            </div>

            {/* Attendance */}
            {student.attendance&&(
              <>
                <div className="rc-sh"><span className="rc-sh-dot"/>Attendance Record</div>
                <div className="rc-attgrid">
                  {[{l:'Days Present',v:student.attendance.present??'—',c:'#15803D'},{l:'Days Absent',v:student.attendance.absent??'—',c:'#B91C1C'},{l:'Days Late',v:student.attendance.late??'—',c:'#B45309'},{l:'Attendance Rate',v:`${student.attendance.rate??0}%`,c:'#1D4ED8'}].map(a=>(
                    <div key={a.l} className="rc-attpill">
                      <div className="rc-attv" style={{ color:a.c }}>{a.v}</div>
                      <div className="rc-attl">{a.l}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Remarks */}
            <div className="rc-sh"><span className="rc-sh-dot"/>Remarks</div>
            <div className="rc-rbox">
              <div className="rc-rlabel">Class Teacher's Remarks</div>
              <div className="rc-rtext">{summary.teacherRemark||autoRemark(avg)}</div>
            </div>
            <div className="rc-rbox">
              <div className="rc-rlabel">Principal's Remarks</div>
              <div className="rc-rtext">{summary.principalRemark||''}</div>
            </div>

            {/* Next term */}
            <div className="rc-sh"><span className="rc-sh-dot"/>Next Term Information</div>
            <div className="rc-nextgrid">
              <div className="rc-nextcard">
                <div className="rc-nextl">Next Term Begins</div>
                <div className="rc-nextv">{summary.nextTermDate||'—'}</div>
              </div>
              <div className="rc-nextcard">
                <div className="rc-nextl">School Fees (Next Term)</div>
                <div className="rc-nextv">{summary.nextTermFee?`₦${Number(summary.nextTermFee).toLocaleString()}`:'—'}</div>
              </div>
            </div>

            {/* Signatures */}
            <div className="rc-signgrid">
              {[{title:'Class Teacher',role:'Signature & Date'},{title:'Vice Principal (Academics)',role:'Signature & Date'},{title:'Principal / Head Teacher',role:'Signature & Date'}].map(s=>(
                <div key={s.title} className="rc-signbox">
                  <div className="rc-signgap"/>
                  <div className="rc-signline"/>
                  <div className="rc-signtitle">{s.title}</div>
                  <div className="rc-signrole">{s.role}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="rc-footer">
              <span>Printed: {NOW.toLocaleString('en-GB')}</span>
              <span className="rc-footer-stamp">Official Academic Document · {schoolName}</span>
              <span>{session} · {termLabel}</span>
            </div>

          </div>{/* rc-body */}
        </div>{/* rc-card */}
        </div>
      )}
    </div>
    </>
  );
}

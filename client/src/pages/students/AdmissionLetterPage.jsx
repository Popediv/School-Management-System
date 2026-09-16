import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import { studentService } from '../../services';
import api from '../../services/api';

export function AdmissionLetterContent({ student, settings, isBulk = false }) {
  if (!student) return null;

  const photoUrl = student.photo
    ? (student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`)
    : null;
  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();
  const moodleUsername = student.moodleUsername || (student.admissionNo ? student.admissionNo.replace(/-/g, '').toLowerCase() : '');
  const moodlePassword = student.moodlePassword || (student.lastName ? student.lastName.trim().toLowerCase() : '');

  const rules = [
    { num: 1, title: 'Punctuality', text: 'Students must resume school on time and attend all scheduled classes and school activities.' },
    { num: 2, title: 'Regular Attendance', text: 'Students are expected to attend school regularly. Absence must be properly explained by a parent/guardian.' },
    { num: 3, title: 'Proper Uniform', text: 'Students must wear the approved school uniform, shoes, and other required items neatly and correctly every school day.' },
    { num: 4, title: 'Good Conduct', text: 'Students must show respect to school authorities, teachers, staff, fellow students, visitors, and members of the community.' },
    { num: 5, title: 'Academic Responsibility', text: 'Students must attend classes, complete assignments, participate in practical activities, and prepare adequately for tests and examinations.' },
    { num: 6, title: 'School Property', text: 'Students must handle school property, books, furniture, laboratory equipment, computers, and other facilities with care. Any deliberate damage may attract appropriate disciplinary action.' },
    { num: 7, title: 'Bullying and Fighting', text: 'Bullying, fighting, intimidation, harassment, threats, and deliberate acts of violence are strictly prohibited.' },
    { num: 8, title: 'Electronic Devices', text: 'The use of mobile phones and other electronic devices during school hours is subject to school regulations and may be restricted or prohibited where necessary.' },
    { num: 9, title: 'Examinations', text: 'Students must not engage in examination malpractice, cheating, impersonation, or any other form of academic dishonesty.' },
    { num: 10, title: 'Cleanliness', text: 'Students must keep themselves and the school environment clean and properly dispose of waste.' },
    { num: 11, title: 'Unauthorized Leaving', text: 'No student may leave the school premises during school hours without proper permission from the appropriate school authority.' },
    { num: 12, title: 'Disciplinary Measures', text: 'Students who violate school rules may be subject to appropriate disciplinary measures in accordance with the school\'s disciplinary procedures.' },
    { num: 13, title: 'Acceptance of Rules', text: 'Admission is subject to the student\'s willingness to comply with the rules and regulations of the school as may be amended from time to time.' }
  ];

  return (
    <div
      className="print-document card mx-auto"
      style={{
        width: '210mm',
        maxHeight: '285mm',
        boxSizing: 'border-box',
        backgroundColor: 'white',
        color: '#0F172A',
        padding: '20px 32px',
        fontFamily: "'Times New Roman', Times, serif",
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: isBulk ? 'none' : '0 4px 20px rgba(0,0,0,0.08)',
        borderRadius: isBulk ? '0' : '8px',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {/* Watermark of the School Logo */}
      {settings?.logoUrl && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-15deg)',
          width: '260px',
          height: '260px',
          backgroundImage: `url(${settings.logoUrl})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.04,
          pointerEvents: 'none',
          zIndex: 0
        }} />
      )}

      <div>
        {/* Letterhead */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 8 }}>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="School Logo" style={{ width: 68, height: 68, objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 68, height: 68, background: '#0F172A', borderRadius: '6px', color: '#EAB308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px', border: '2px solid #EAB308' }}>PCI</div>
          )}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '800', margin: 0, textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif", letterSpacing: '0.5px' }}>
              PATIMO SCHOOLS INTERNATIONAL
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#B45309', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'Outfit', sans-serif" }}>
              Excellence, Integrity, and Knowledge
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#0F172A', fontFamily: "'Inter', sans-serif", lineHeight: '1.35', fontWeight: '600' }}>
              Plot 13&14, Maito Bakery Street, Adesola, Ibadan &nbsp;·&nbsp; ✉ info@patimocollege.edu.ng<br />
              Proprietor: 08034556007 &nbsp;·&nbsp; Principal: 08034877814 &nbsp;·&nbsp; General Manager: 08138070528
            </p>
          </div>
        </div>

        {/* Letterhead border */}
        <div style={{ position: 'relative', zIndex: 1, height: '3px', background: '#0F172A', marginBottom: '2px' }} />
        <div style={{ position: 'relative', zIndex: 1, height: '2px', background: '#EAB308', marginBottom: '10px' }} />

        {/* Date and Ref */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11.5px', fontFamily: "'Inter', sans-serif", color: '#0F172A' }}>
          <div><strong>Ref:</strong> <code style={{ color: '#0F172A', fontWeight: 'bold', fontSize: '12px' }}>{student.admissionNo}</code></div>
          <div><strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>

        {/* Salutation */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '8px', fontSize: '13px', color: '#0F172A' }}>
          <p style={{ margin: 0 }}>Dear <strong>{student.parent?.name || 'Parent/Guardian'}</strong>,</p>
        </div>

        {/* Body Heading & Paragraph */}
        <div style={{ position: 'relative', zIndex: 1, fontSize: '12.5px', lineHeight: '1.45', textAlign: 'justify', color: '#0F172A' }}>
          <h2 style={{ textAlign: 'center', fontSize: '14.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0', textDecoration: 'underline' }}>
            Official Letter of Provisional Admission
          </h2>

          <p style={{ margin: '0 0 10px 0' }}>
            We are pleased to inform you that following a successful screening process,
            <strong> {student.firstName} {student.lastName} {student.otherNames || ''}</strong> has been offered provisional admission
            into <strong>{student.currentClass?.name || 'our institution'}</strong> for the <strong>{student.session}</strong> academic session.
          </p>
        </div>

        {/* Student Credentials & Photo Box */}
        <div style={{ position: 'relative', zIndex: 1, backgroundColor: '#F8FAFC', border: '1.5px solid #0F172A', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px', marginBottom: '6px' }}>
            <h3 style={{ fontSize: '11px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0F172A', fontWeight: 'bold' }}>
              Student Profile & School Portal Login Credentials
            </h3>
            <span style={{ fontSize: '9px', color: '#0F172A', fontWeight: 800, letterSpacing: '0.5px' }}>CONFIDENTIAL</span>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', color: '#0F172A' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '2px 0', width: '36%', fontWeight: 'bold' }}>Full Name:</td>
                    <td style={{ padding: '2px 0', fontWeight: '700' }}>{student.lastName.toUpperCase()}, {student.firstName} {student.otherNames || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Admission Number:</td>
                    <td style={{ padding: '2px 0', fontWeight: '700' }}>{student.admissionNo}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Class Admitted:</td>
                    <td style={{ padding: '2px 0', fontWeight: '700' }}>{student.currentClass?.name || '—'}</td>
                  </tr>
                  <tr><td colSpan="2" style={{ padding: '2px 0' }}><hr style={{ margin: 0, borderColor: '#CBD5E1' }} /></td></tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>School Portal URL:</td>
                    <td style={{ padding: '2px 0', fontFamily: 'monospace', fontSize: '10.5px', fontWeight: '700', color: '#1D4ED8' }}>
                      https://patimo-sms.vercel.app
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Portal/Moodle Username:</td>
                    <td style={{ padding: '2px 0', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: '#B45309' }}>
                      {moodleUsername}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Portal/Moodle Password:</td>
                    <td style={{ padding: '2px 0', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: '#0F172A' }}>
                      {moodlePassword}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>Student Email:</td>
                    <td style={{ padding: '2px 0', fontFamily: 'monospace', fontSize: '10.5px', fontWeight: 'bold', color: '#0F172A' }}>
                      {student.user?.email || `${student.currentClass?.name ? student.currentClass.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'student'}@gmail.com`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Passport Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              <div style={{
                width: '78px',
                height: '92px',
                border: '2px solid #0F172A',
                borderRadius: '4px',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {photoUrl ? (
                  <img src={photoUrl} alt={`${student.firstName} ${student.lastName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#F1F5F9', color: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    <span style={{ fontSize: '18px' }}>{initials}</span>
                    <span style={{ fontSize: '7px', textTransform: 'uppercase', marginTop: '2px', fontWeight: 'bold' }}>Passport</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#0F172A', textTransform: 'uppercase' }}>
                Passport Photo
              </span>
            </div>
          </div>
        </div>

        {/* School Rules & Regulations Section */}
        <div style={{ position: 'relative', zIndex: 1, backgroundColor: '#FFFFFF', border: '1.5px solid #0F172A', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '11px', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0F172A', fontWeight: '800', textAlign: 'center', borderBottom: '1px solid #0F172A', paddingBottom: '3px' }}>
            SCHOOL RULES AND REGULATIONS
          </h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '9px', color: '#0F172A', fontStyle: 'italic', fontWeight: '600', textAlign: 'center' }}>
            By accepting admission into Patimo Schools International, every student and parent/guardian agrees to abide by the following rules:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '8.8px', lineHeight: '1.3', color: '#0F172A', fontFamily: "'Inter', sans-serif" }}>
            {rules.map(r => (
              <div key={r.num} style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
                <strong style={{ color: '#0F172A', minWidth: '15px', flexShrink: 0 }}>{r.num}.</strong>
                <span><strong style={{ color: '#0F172A' }}>{r.title}:</strong> {r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sign Off & Footer */}
      <div style={{ position: 'relative', zIndex: 1, fontSize: '11.5px', color: '#0F172A', marginTop: '12px' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Congratulations once again, and welcome to Patimo Schools International!</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '36px' }}>
          <div style={{ borderTop: '1.5px solid #0F172A', paddingTop: '4px', width: '220px' }}>
            <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>The Principal</strong><br />
            <span style={{ fontSize: '10px', color: '#0F172A', fontWeight: '600' }}>PATIMO SCHOOLS INTERNATIONAL</span>
          </div>
          <div style={{ width: 58, height: 58, border: '2px dashed #0F172A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', color: '#0F172A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Official Seal
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdmissionLetterPage() {
  const { id } = useParams();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentService.getById(id).then(r => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO SCHOOLS INTERNATIONAL' }
  });

  const handlePrint = () => window.print();

  if (isLoading) return <div className="p-8 text-center text-muted">Loading admission letter...</div>;
  if (!student) return <div className="p-8 text-center text-muted">Student not found.</div>;

  return (
    <div>
      {/* Hide controls when printing */}
      <div className="print-hidden flex items-center justify-between mb-6">
        <Link to={`/students/${id}`} className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Profile
        </Link>
        <button className="btn btn-primary" onClick={handlePrint}>
          <Printer size={16} /> Print Admission Letter
        </button>
      </div>

      <AdmissionLetterContent student={student} settings={settings} />

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background: white; margin: 0; padding: 0; color: #000000 !important; }
          .topbar, .sidebar, .print-hidden { display: none !important; }
          .print-document { 
            box-shadow: none !important; 
            margin: 0 auto !important; 
            padding: 18px 30px !important; 
            width: 210mm !important;
            max-height: 285mm !important;
            box-sizing: border-box !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            color: #000000 !important;
          }
          .print-document * {
            color: #000000 !important;
          }
          #root, .app-container, .main-content { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}

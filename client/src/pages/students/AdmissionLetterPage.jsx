import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import { studentService } from '../../services';
import api from '../../services/api';

export default function AdmissionLetterPage() {
  const { id } = useParams();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentService.getById(id).then(r => r.data),
  });

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE' }
  });

  const handlePrint = () => window.print();

  if (isLoading) return <div className="p-8 text-center text-muted">Loading admission letter...</div>;
  if (!student) return <div className="p-8 text-center text-muted">Student not found.</div>;

  const photoUrl = student.photo
    ? (student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`)
    : null;
  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();
  const moodleUsername = student.moodleUsername || (student.admissionNo ? student.admissionNo.replace(/-/g, '').toLowerCase() : '');
  const moodlePassword = student.moodlePassword || (student.lastName ? student.lastName.trim().toLowerCase() : '');

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

      <div
        className="print-document card mx-auto"
        style={{
          width: '210mm',
          height: '297mm',
          boxSizing: 'border-box',
          backgroundColor: 'white',
          color: '#0F172A',
          padding: '24px 36px',
          fontFamily: "'Times New Roman', Times, serif",
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          borderRadius: '8px'
        }}
      >
        {/* Watermark of the School Logo */}
        {settings?.logoUrl && (
          <div style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-15deg)',
            width: '280px',
            height: '280px',
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
          {/* Professional Corporate School Letterhead */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 12 }}>
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="School Logo" style={{ width: 80, height: 80, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: 80, height: 80, background: '#0F172A', borderRadius: '8px', color: '#EAB308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', border: '2px solid #EAB308' }}>PCI</div>
            )}
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h1 style={{ color: '#0F172A', fontSize: '26px', fontWeight: '800', margin: 0, textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif", letterSpacing: '0.5px' }}>
                PATIMO COLLEGE
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#EAB308', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: "'Outfit', sans-serif" }}>
                Excellence, Integrity, and Knowledge
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: '#64748B', fontFamily: "'Inter', sans-serif", lineHeight: '1.4' }}>
                Plot 13$14, Maito Bakery Street, Adesola, Ibadan &nbsp;·&nbsp; ✉ info@patimocollege.edu.ng<br />
                Proprietor: 08034556007 &nbsp;·&nbsp; Principal: 08034877814 &nbsp;·&nbsp; General Manager: 08138070528
              </p>
            </div>
          </div>

          {/* Letterhead border: Premium gold/blue double line */}
          <div style={{ position: 'relative', zIndex: 1, height: '4px', background: '#0F172A', marginBottom: '2px' }} />
          <div style={{ position: 'relative', zIndex: 1, height: '2px', background: '#EAB308', marginBottom: '20px' }} />

          {/* Date and Ref - Compact */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', fontFamily: "'Inter', sans-serif" }}>
            <div><strong>Ref:</strong> <code style={{ color: '#0F172A', fontWeight: 'bold', fontSize: '13.5px' }}>{student.admissionNo}</code></div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>

          {/* Salutation */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: '12px', fontSize: '15px' }}>
            <p>Dear <strong>{student.parent?.name || 'Parent/Guardian'}</strong>,</p>
          </div>

          {/* Body - Compact but beautifully spaced */}
          <div style={{ position: 'relative', zIndex: 1, fontSize: '14.5px', lineHeight: '1.5', textAlign: 'justify' }}>
            <h2 style={{ textAlign: 'center', fontSize: '17px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px 0', textDecoration: 'underline' }}>
              Official Letter of Provisional Admission
            </h2>

            <p style={{ marginBottom: '12px' }}>
              We are pleased to inform you that following a successful application and screening process,
              <strong> {student.firstName} {student.lastName} {student.otherNames || ''}</strong> has been offered provisional admission
              into <strong>{student.currentClass?.name || 'our institution'}</strong> for the <strong>{student.session}</strong> academic session.
            </p>

            <p style={{ marginBottom: '18px' }}>
              Please find the student's unique admission details and digital portal login credentials below. These credentials grant access to our School Management System and E-Learning Platform (Moodle), where you can track academic progress, view reports, and manage fee payments.
            </p>
          </div>

          {/* Details Box - Beautiful border, passport photo & moodle login credentials */}
          <div style={{ position: 'relative', zIndex: 1, backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', padding: '14px 18px', borderRadius: '6px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #CBD5E1', paddingBottom: '6px', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '13.5px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0F172A', fontWeight: 'bold' }}>
                Student Profile & E-Learning (Moodle) Credentials
              </h3>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>CONFIDENTIAL</span>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {/* Profile & Login Details Table */}
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', fontSize: '12.5px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '3px 0', width: '38%', fontWeight: 'bold', color: '#475569' }}>Full Name:</td>
                      <td style={{ padding: '3px 0', fontWeight: '700', color: '#0F172A' }}>{student.lastName.toUpperCase()}, {student.firstName} {student.otherNames || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#475569' }}>Admission Number:</td>
                      <td style={{ padding: '3px 0', fontWeight: '700', color: '#0F172A' }}>{student.admissionNo}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#475569' }}>Class Admitted:</td>
                      <td style={{ padding: '3px 0', fontWeight: '700', color: '#0F172A' }}>{student.currentClass?.name || '—'}</td>
                    </tr>
                    <tr><td colSpan="2" style={{ padding: '4px 0' }}><hr style={{ margin: 0, borderColor: '#E2E8F0' }} /></td></tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#0F172A' }}>Moodle Portal URL:</td>
                      <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: '12.5px', fontWeight: '600', color: '#2563EB' }}>
                        https://moodle.patimocollege.edu.ng
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#0F172A' }}>Moodle Username:</td>
                      <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 'bold', color: '#D97706' }}>
                        {moodleUsername}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#0F172A' }}>Moodle Default Password:</td>
                      <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: '13.5px', fontWeight: 'bold', color: '#0F172A' }}>
                        {moodlePassword}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '3px 0', fontWeight: 'bold', color: '#0F172A' }}>School Portal Email:</td>
                      <td style={{ padding: '3px 0', fontFamily: 'monospace', fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                        {student.user?.email || `${moodleUsername}@patimo.edu`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Student Passport Photograph */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <div style={{
                  width: '95px',
                  height: '115px',
                  border: '2px solid #0F172A',
                  borderRadius: '4px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center'
                }}>
                  {photoUrl ? (
                    <img src={photoUrl} alt={`${student.firstName} ${student.lastName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#F1F5F9', color: '#334155', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      <span style={{ fontSize: '24px' }}>{initials}</span>
                      <span style={{ fontSize: '8.5px', textTransform: 'uppercase', color: '#94A3B8', marginTop: '2px', letterSpacing: '0.5px' }}>Passport</span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Passport Photo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Off & Footer (Docked neatly at the bottom) */}
        <div style={{ position: 'relative', zIndex: 1, fontSize: '14.5px' }}>
          <p style={{ margin: '0 0 35px 0' }}>Congratulations once again, and welcome to the PATIMO COLLEGE family!</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ borderTop: '1px solid #475569', paddingTop: '6px', width: '220px' }}>
              <strong style={{ fontSize: '13.5px', color: '#0F172A' }}>The Principal</strong><br />
              <span style={{ fontSize: '11px', color: '#64748B' }}>PATIMO COLLEGE</span>
            </div>
            {/* Elegant Official Seal Placeholder */}
            <div style={{ width: 64, height: 64, border: '2px dashed #CBD5E1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Official Seal
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background: white; margin: 0; padding: 0; }
          .topbar, .sidebar, .print-hidden { display: none !important; }
          .print-document { 
            box-shadow: none !important; 
            margin: 0 !important; 
            padding: 24px 36px !important; 
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
          }
          #root, .app-container, .main-content { margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
}

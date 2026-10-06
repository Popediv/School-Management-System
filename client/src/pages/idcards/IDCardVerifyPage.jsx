import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { CardFront, CardBack, C, SANS, SERIF } from './IDCardPage';

export default function IDCardVerifyPage() {
    const { studentId } = useParams();
    const [flipped, setFlipped] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ['idcard-verify', studentId],
        queryFn: () => api.get(`/idcards/verify/${studentId}`).then(r => r.data),
        retry: 1
    });

    const student = data?.student;
    const settings = data?.settings;

    if (isLoading) {
        return (
            <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS }}>
                <div style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ width: 44, height: 44, border: `3px solid ${C.sage}`, borderTopColor: C.green, borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ color: C.forest, fontWeight: 700, fontSize: '0.9rem' }}>Verifying Student Identity…</p>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div style={{ minHeight: '100vh', background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: SANS }}>
                <div style={{ background: '#FFFFFF', borderRadius: 24, padding: '40px 32px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid #F1F5F9' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <AlertCircle size={32} />
                    </div>
                    <h2 style={{ color: '#0F172A', fontFamily: SERIF, fontSize: '1.4rem', fontWeight: 800, margin: '0 0 10px' }}>Verification Unsuccessful</h2>
                    <p style={{ color: '#64748B', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>
                        The scanned QR code link is invalid or the student identity record could not be found in our official register.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: C.cream, fontFamily: SANS, padding: '32px 20px 48px', position: 'relative' }}>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>

                {/* Official Verification Header */}
                <div style={{ background: 'linear-gradient(135deg, #064E3B 0%, #022C22 100%)', borderRadius: 20, padding: '20px 24px', color: '#FFFFFF', marginBottom: 28, boxShadow: '0 10px 30px rgba(6,78,59,0.25)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', borderRadius: 30, padding: '6px 14px', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6EE7B7', marginBottom: 12 }}>
                        <ShieldCheck size={16} /> Official Identity Verified
                    </div>
                    <h1 style={{ fontFamily: SERIF, fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', letterSpacing: '0.02em' }}>
                        {settings?.schoolName || 'PATIMO SCHOOLS INTERNATIONAL'}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.85 }}>Digital Softcopy Student Identity Record</p>
                </div>

                {/* Card Flip Helper Banner */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <button
                        onClick={() => setFlipped(!flipped)}
                        style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 30, padding: '8px 20px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: C.forest, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <RefreshCw size={14} /> Showing {flipped ? 'Back Card' : 'Front Card'} (Tap to flip)
                    </button>
                </div>

                {/* Softcopy Digital ID Card Preview */}
                <div style={{ display: 'flex', justifyContent: 'center', perspective: 1200 }}>
                    <div
                        onClick={() => setFlipped(!flipped)}
                        style={{ cursor: 'pointer', transition: 'transform 0.7s cubic-bezier(0.4,0,0.2,1)', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)', position: 'relative', width: 320, height: 500 }}
                    >
                        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                            <CardFront student={student} logo={settings?.logoUrl} settings={settings} />
                        </div>
                        <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            <CardBack student={student} settings={settings} />
                        </div>
                    </div>
                </div>

                {/* Footer Record Status */}
                <div style={{ marginTop: 32, textAlign: 'center', color: C.muted, fontSize: '0.74rem' }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: C.forest }}>
                        Admission No: <code>{student.admissionNo}</code> &nbsp;·&nbsp; Status: <span style={{ color: '#059669', fontWeight: 800 }}>ACTIVE</span>
                    </p>
                    <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.8 }}>
                        Scanned &amp; verified directly from school central record system
                    </p>
                </div>

            </div>
        </div>
    );
}

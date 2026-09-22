import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { attendanceService, digitalPersonaService } from '../../services';
import { QrCode, Fingerprint, Clock, XCircle, RefreshCw, UserCheck, ShieldAlert, Camera, CameraOff } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

const playChime = (type) => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'late') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(349.23, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
        } else {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) { console.error('Audio chime error:', e); }
};

export default function KioskAttendancePage() {
    const [scanMode, setScanMode] = useState('barcode'); // 'barcode' | 'webcam' | 'fingerprint'
    const [barcodeInput, setBarcodeInput] = useState('');
    const [scanning, setScanning] = useState(false);
    const [lastScanResult, setLastScanResult] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [absentLoading, setAbsentLoading] = useState(false);
    const [webcamActive, setWebcamActive] = useState(false);
    const inputRef = useRef(null);
    const scannerRef = useRef(null);
    const scannerDivRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (scanMode === 'barcode' && inputRef.current) inputRef.current.focus();
    }, [scanMode, scanning]);

    // Webcam QR scanner lifecycle
    useEffect(() => {
        if (scanMode === 'webcam' && webcamActive) {
            const qrScanner = new Html5QrcodeScanner('qr-reader', {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                rememberLastUsedCamera: true,
            }, false);

            let scanBusy = false;
            qrScanner.render(
                async (decodedText) => {
                    if (scanBusy) return;
                    scanBusy = true;
                    qrScanner.pause();
                    await processCode(decodedText);
                    setTimeout(() => { scanBusy = false; qrScanner.resume(); }, 2500);
                },
                () => { /* quiet scan errors */ }
            );

            scannerRef.current = qrScanner;
            return () => { qrScanner.clear().catch(() => { }); scannerRef.current = null; };
        }
    }, [scanMode, webcamActive]); // eslint-disable-line

    const processCode = async (code) => {
        if (!code?.trim()) return;
        setScanning(true);
        try {
            const res = await attendanceService.kioskScan({ code: code.trim() });
            const data = res.data;
            setLastScanResult({ ...data, error: false });
            setRecentLogs(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 9)]);
            playChime(data.status === 'PRESENT' ? 'success' : 'late');
            toast.success(data.message);
        } catch (err) {
            const msg = err.response?.data?.message || 'Unrecognized ID / QR code';
            playChime('error');
            setLastScanResult({ error: true, message: msg, code });
            toast.error(msg);
        } finally {
            setScanning(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleBarcodeSubmit = async (e) => {
        e.preventDefault();
        if (!barcodeInput.trim() || scanning) return;
        const code = barcodeInput.trim();
        setBarcodeInput('');
        await processCode(code);
    };

    const triggerFingerprintScan = async () => {
        setScanning(true);
        toast.info('Place finger on the DigitalPersona U.are.U 4500 reader...');
        try {
            const dpRes = await digitalPersonaService.captureFingerprint();
            if (dpRes.success && dpRes.template) {
                await processCode(dpRes.template.trim());
            } else {
                playChime('error');
                setLastScanResult({ error: true, message: 'DigitalPersona reader not detected on USB / driver port' });
                toast.warning('DigitalPersona reader not detected on local ports');
                setScanning(false);
            }
        } catch (err) {
            playChime('error');
            setLastScanResult({ error: true, message: 'Fingerprint match failed' });
            toast.error('Fingerprint match failed');
            setScanning(false);
        }
    };

    const handleMarkAbsent = async () => {
        if (!window.confirm('Mark all unscanned active students as ABSENT for today?')) return;
        setAbsentLoading(true);
        try {
            const res = await attendanceService.autoMarkAbsent({});
            toast.success(res.data.message);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to auto-mark absences');
        } finally { setAbsentLoading(false); }
    };

    const handleModeChange = (mode) => {
        if (scannerRef.current) { scannerRef.current.clear().catch(() => { }); scannerRef.current = null; }
        setWebcamActive(false);
        setScanMode(mode);
        setLastScanResult(null);
    };

    const stopWebcam = () => {
        if (scannerRef.current) { scannerRef.current.clear().catch(() => { }); scannerRef.current = null; }
        setWebcamActive(false);
    };

    return (
        <div>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserCheck size={28} className="text-primary" /> Attendance Kiosk
                    </h1>
                    <p className="page-header-subtitle">Real-time student check-in — Barcode, Webcam QR, or Fingerprint</p>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Clock size={20} style={{ color: 'var(--primary)' }} />
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace' }}>
                            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-xs text-muted">
                            {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mode card */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                    <button className={`btn ${scanMode === 'barcode' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleModeChange('barcode')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <QrCode size={16} /> USB Barcode / Admission No
                    </button>
                    <button className={`btn ${scanMode === 'webcam' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleModeChange('webcam')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={16} /> Webcam QR Scanner
                    </button>
                    {false && (
                        <button className={`btn ${scanMode === 'fingerprint' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => handleModeChange('fingerprint')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Fingerprint size={16} /> USB Fingerprint
                        </button>
                    )}
                    <button className="btn btn-warning" onClick={handleMarkAbsent} disabled={absentLoading} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {absentLoading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                        Mark Unscanned as ABSENT
                    </button>
                </div>

                {/* Barcode mode */}
                {scanMode === 'barcode' && (
                    <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <QrCode size={20} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
                            <input
                                ref={inputRef}
                                type="text"
                                className="form-control"
                                style={{ paddingLeft: 44, fontSize: '1.05rem', height: 48 }}
                                placeholder="Scan ID barcode or type Admission No (e.g. PCI-260100)…"
                                value={barcodeInput}
                                onChange={e => setBarcodeInput(e.target.value)}
                                disabled={scanning}
                                autoFocus
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ height: 48, paddingInline: 24 }} disabled={scanning || !barcodeInput.trim()}>
                            {scanning ? 'Checking…' : 'Check In'}
                        </button>
                    </form>
                )}

                {/* Webcam QR mode */}
                {scanMode === 'webcam' && (
                    <div style={{ textAlign: 'center' }}>
                        {!webcamActive ? (
                            <button className="btn btn-primary btn-lg" onClick={() => setWebcamActive(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <Camera size={20} /> Start Webcam QR Scanner
                            </button>
                        ) : (
                            <>
                                <div id="qr-reader" ref={scannerDivRef} style={{ maxWidth: 380, margin: '0 auto' }} />
                                <button className="btn btn-secondary btn-sm" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={stopWebcam}>
                                    <CameraOff size={14} /> Stop Camera
                                </button>
                                <p className="text-xs text-muted" style={{ marginTop: 8 }}>
                                    Point your webcam at the student's QR code (on ID card or admission letter) to auto-scan.
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* Fingerprint mode */}
                {scanMode === 'fingerprint' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', border: '2px solid var(--primary)' }}>
                            <Fingerprint size={42} style={{ color: 'var(--primary)' }} />
                        </div>
                        <h3 style={{ marginBottom: 6 }}>USB Fingerprint Scanner</h3>
                        <p className="text-muted" style={{ marginBottom: 18, fontSize: '0.9rem' }}>
                            Place student thumb on DigitalPersona or Futronic USB scanner, then click below.
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={triggerFingerprintScan} disabled={scanning} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {scanning ? <><RefreshCw size={16} className="animate-spin" /> Listening…</> : <><Fingerprint size={18} /> Trigger Fingerprint Scan</>}
                        </button>
                    </div>
                )}
            </div>

            {/* Result + Log */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Latest Scan */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', justifyContent: 'center', minHeight: 300 }}>
                    {lastScanResult ? (
                        lastScanResult.error ? (
                            <div style={{ padding: 24 }}>
                                <XCircle size={60} style={{ color: 'var(--danger)', marginBottom: 14 }} />
                                <h2 style={{ color: 'var(--danger)', marginBottom: 8 }}>Check-in Failed</h2>
                                <p className="text-muted">{lastScanResult.message}</p>
                            </div>
                        ) : (
                            <div style={{ width: '100%', padding: 12 }}>
                                <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 14px', border: `4px solid ${lastScanResult.status === 'PRESENT' ? 'var(--success)' : 'var(--warning)'}`, background: 'var(--bg-card-hover)' }}>
                                    {lastScanResult.student?.photo ? (
                                        <img src={lastScanResult.student.photo.startsWith('http') ? lastScanResult.student.photo : `/uploads/${lastScanResult.student.photo}`} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                            {lastScanResult.student?.firstName?.[0]}
                                        </div>
                                    )}
                                </div>
                                <span className={`badge ${lastScanResult.status === 'PRESENT' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.95rem', padding: '5px 14px', marginBottom: 10, borderRadius: 20 }}>
                                    {lastScanResult.status === 'PRESENT' ? '✓ ON TIME' : '⚠️ LATE'}
                                </span>
                                <h2 style={{ marginBottom: 4 }}>{lastScanResult.student?.lastName} {lastScanResult.student?.firstName}</h2>
                                <p className="text-muted">{lastScanResult.student?.admissionNo} · {lastScanResult.student?.className}</p>
                                <div style={{ background: 'rgba(79,70,229,0.08)', borderRadius: 'var(--radius-md)', padding: '10px 18px', marginTop: 12, display: 'inline-block' }}>
                                    ⏰ <strong style={{ color: 'var(--primary)' }}>{lastScanResult.time}</strong>
                                </div>
                            </div>
                        )
                    ) : (
                        <div style={{ color: 'var(--text-muted)', padding: 40 }}>
                            <QrCode size={48} style={{ opacity: 0.35, marginBottom: 12 }} />
                            <h3>Ready to Scan</h3>
                            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Use any scan mode to record student attendance.</p>
                        </div>
                    )}
                </div>

                {/* Log */}
                <div className="card">
                    <h3 style={{ marginBottom: 14 }}>Today's Check-in Log</h3>
                    {recentLogs.length === 0 ? (
                        <p className="text-muted" style={{ textAlign: 'center', padding: 32, fontSize: '0.9rem' }}>No scans yet today.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {recentLogs.map(log => (
                                <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{log.student?.lastName} {log.student?.firstName}</div>
                                        <div className="text-xs text-muted">{log.student?.admissionNo} · {log.student?.className}</div>
                                    </div>
                                    <div style={{ textAlign: 'end' }}>
                                        <span className={`badge ${log.status === 'PRESENT' ? 'badge-success' : 'badge-warning'}`}>{log.status}</span>
                                        <div className="text-xs text-muted" style={{ marginTop: 2 }}>{log.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

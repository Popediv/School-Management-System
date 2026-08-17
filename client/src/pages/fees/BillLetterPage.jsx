import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useReactToPrint } from 'react-to-print';
import { billLetterService, feeService, classService, studentService } from '../../services';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import {
    FileText, Printer, Users, Plus, Trash2,
    BookOpen, Percent, Award, Search, Eye, X
} from 'lucide-react';

// ─── Per-class default fee schedule (from school fee sheet) ──────────────────
const DEFAULT_FEES = {
    JSS1: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 7000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 15000 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 8000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 5000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
    JSS2: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 7000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 15000 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 8000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 5000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
    JSS3: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 7000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 18000 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 8000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 5000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
    SS1: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 8000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 20000 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 10000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 6000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
    SS2: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 8000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 22500 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 10000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 6000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
    SS3: [{ feeLabel: 'Application Form', category: 'APPLICATION', originalAmount: 2500 }, { feeLabel: 'Uniform', category: 'UNIFORM', originalAmount: 8000 }, { feeLabel: 'ID Card', category: 'IDCARD', originalAmount: 2500 }, { feeLabel: 'Tuition', category: 'TUITION', originalAmount: 25000 }, { feeLabel: 'Lesson Fee', category: 'LESSON', originalAmount: 10000 }, { feeLabel: 'Sportwear', category: 'UNIFORM', originalAmount: 6000 }, { feeLabel: 'Friday Wear', category: 'UNIFORM', originalAmount: 2500 }],
};

function getDefaultsForClass(className) {
    if (!className) return [];
    const upper = className.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Try direct match first, then partial key match
    const key = Object.keys(DEFAULT_FEES).find(k => upper.includes(k.replace(/[^A-Z0-9]/g, '')));
    const defaults = key ? DEFAULT_FEES[key] : [];
    return defaults.map((d, idx) => ({
        ...d,
        discountPercent: 0,
        isScholarship: false,
        isIncluded: true,
        sortOrder: idx,
    }));
}

// ─── Tab button (defined outside to prevent remount on parent re-render) ──────
function TabBtn({ id, icon: Icon, label, activeMode, onClick }) {
    return (
        <button
            onClick={() => onClick(id)}
            style={{
                padding: '12px 20px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none',
                color: activeMode === id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeMode === id ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
        >
            <Icon size={16} /> {label}
        </button>
    );
}

// ─── Items composer (defined outside to prevent input focus loss) ─────────────
function ItemsComposer({ itemsList, onUpdate, onRemove, onAdd, showBulkNote = false }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label className="form-label" style={{ margin: 0 }}>Fee Items</label>
                <button onClick={onAdd} className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>
                    <Plus size={13} /> Add Custom Item
                </button>
            </div>
            {showBulkNote && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                    These settings apply to <strong>all students</strong> in the selected class.
                </p>
            )}
            {itemsList.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Select a class above to auto-load fee items, or add a custom item.
                </div>
            )}
            {itemsList.map((item, idx) => (
                <div key={idx} style={{
                    padding: '12px 14px', marginBottom: 8,
                    background: item.isIncluded ? 'var(--bg-elevated)' : 'var(--bg-body)',
                    borderRadius: 8, border: `1px solid ${item.isIncluded ? 'var(--border)' : 'var(--border-light)'}`,
                    opacity: item.isIncluded ? 1 : 0.55, transition: 'all 0.2s'
                }}>
                    {/* Row 1: checkbox, label, amount, delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <input type="checkbox" checked={item.isIncluded}
                            onChange={e => onUpdate(idx, 'isIncluded', e.target.checked)}
                            style={{ cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }} />

                        <input
                            className="form-input" style={{ flex: 2, minWidth: 130, padding: '6px 10px', fontSize: '0.88rem' }}
                            value={item.feeLabel} placeholder="Fee name"
                            onChange={e => onUpdate(idx, 'feeLabel', e.target.value)}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>₦</span>
                            <input
                                className="form-input" type="number" style={{ width: 110, padding: '6px 10px', fontSize: '0.88rem' }}
                                value={item.originalAmount} placeholder="Amount"
                                onChange={e => onUpdate(idx, 'originalAmount', e.target.value)}
                            />
                        </div>

                        <button onClick={() => onRemove(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', flexShrink: 0 }}>
                            <Trash2 size={15} />
                        </button>
                    </div>

                    {/* Row 2: Discount & Scholarship (always visible) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, marginLeft: 26, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Percent size={11} /> Discount %:
                        </label>
                        <input
                            className="form-input" type="number" min="0" max="100"
                            style={{ width: 72, padding: '5px 8px', fontSize: '0.82rem' }}
                            value={item.discountPercent} placeholder="0"
                            onChange={e => onUpdate(idx, 'discountPercent', e.target.value)}
                            disabled={item.isScholarship}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
                            <input
                                type="checkbox" checked={!!item.isScholarship}
                                onChange={e => {
                                    onUpdate(idx, 'isScholarship', e.target.checked);
                                    if (e.target.checked) onUpdate(idx, 'discountPercent', 100);
                                    else onUpdate(idx, 'discountPercent', 0);
                                }}
                            />
                            <Award size={12} style={{ color: 'var(--accent)' }} /> Full Scholarship (free)
                        </label>

                        {parseFloat(item.originalAmount) > 0 && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600, marginLeft: 'auto' }}>
                                Final: ₦{Number(item.isScholarship ? 0 : parseFloat(item.originalAmount) * (1 - parseFloat(item.discountPercent || 0) / 100)).toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

const fmt = (n) => `₦${Number(n || 0).toLocaleString()}`;

const TERM_LABELS = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' };

// ─── Letter Preview Component (printable) ─────────────────────────
function LetterPreview({ letter, schoolName = 'PATIMO COLLEGE', forwardRef }) {
    if (!letter) return null;
    const includedItems = (letter.items || []).filter(i => i.isIncluded);
    const grandTotal = includedItems.reduce((s, i) => s + i.finalAmount, 0);
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div ref={forwardRef} style={{
            fontFamily: 'Georgia, serif', background: '#fff', color: '#000',
            padding: '40px 48px', maxWidth: 720, margin: '0 auto',
            lineHeight: 1.6, border: '2px solid #000'
        }}>
            {/* Letterhead */}
            <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 16, marginBottom: 24 }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' }}>{schoolName}</div>
                <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#333' }}>Excellence in Education</div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', margin: '0 0 24px' }}>
                <div style={{
                    display: 'inline-block', fontSize: '1rem', fontWeight: 700,
                    textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: 4,
                    letterSpacing: 1
                }}>School Fees Bill</div>
            </div>

            {/* Date + Ref */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontSize: '0.9rem' }}>
                <div><strong>Date:</strong> {today}</div>
                <div><strong>Term:</strong> {TERM_LABELS[letter.term] || letter.term} — {letter.session}</div>
            </div>

            {/* Recipient */}
            <div style={{ marginBottom: 20, fontSize: '0.95rem' }}>
                <div style={{ marginBottom: 4 }}>To: <strong>{letter.parentName}</strong></div>
                <div>Parent/Guardian of: <strong>{letter.studentName}</strong></div>
                <div>Class: <strong>{letter.className}</strong></div>
            </div>

            {/* Body */}
            <p style={{ marginBottom: 20, fontSize: '0.92rem' }}>
                Dear Parent/Guardian,<br /><br />
                Please find below the schedule of school fees payable for the <strong>{TERM_LABELS[letter.term] || letter.term}</strong> of the <strong>{letter.session}</strong> academic session for your ward in <strong>{letter.className}</strong>.
                Kindly ensure all fees are paid promptly to avoid disruption of your child's academic activities.
            </p>

            {/* Fee Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ background: '#000', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>S/N</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Fee Item</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount (₦)</th>
                        {includedItems.some(i => i.discountPercent > 0 || i.isScholarship) && (
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Discount</th>
                        )}
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Final (₦)</th>
                    </tr>
                </thead>
                <tbody>
                    {includedItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #ccc', background: idx % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                            <td style={{ padding: '7px 12px' }}>{idx + 1}</td>
                            <td style={{ padding: '7px 12px' }}>
                                {item.feeLabel}
                                {item.isScholarship && (
                                    <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#000', color: '#fff', padding: '1px 6px', borderRadius: 3 }}>SCHOLARSHIP</span>
                                )}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right' }}>{fmt(item.originalAmount)}</td>
                            {includedItems.some(i => i.discountPercent > 0 || i.isScholarship) && (
                                <td style={{ padding: '7px 12px', textAlign: 'right', color: '#555' }}>
                                    {item.isScholarship ? '100%' : item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}
                                </td>
                            )}
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(item.finalAmount)}</td>
                        </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background: '#000', color: '#fff', fontWeight: 700 }}>
                        <td colSpan={includedItems.some(i => i.discountPercent > 0 || i.isScholarship) ? 4 : 3}
                            style={{ padding: '9px 12px', textAlign: 'right' }}>TOTAL FEES DUE</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: '1.05rem' }}>{fmt(grandTotal)}</td>
                    </tr>
                </tbody>
            </table>

            {/* Notes */}
            {letter.notes && (
                <div style={{ marginBottom: 20, padding: '10px 14px', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.88rem', background: '#fafafa' }}>
                    <strong>Note:</strong> {letter.notes}
                </div>
            )}

            {/* Closing */}
            <p style={{ fontSize: '0.88rem', marginBottom: 32 }}>
                Payment should be made to the school bursar. Please bring your payment receipt for documentation.
                Thank you for your continued support of your child's education.
            </p>

            {/* Signature block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: 180, marginBottom: 4 }} />
                    <div style={{ fontSize: '0.85rem' }}>Principal's Signature</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: 180, marginBottom: 4 }} />
                    <div style={{ fontSize: '0.85rem' }}>School Stamp</div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function BillLetterPage() {
    const qc = useQueryClient();
    const printRef = useRef(null);

    // Tab: 'single' | 'bulk' | 'history'
    const [mode, setMode] = useState('single');

    // Single letter form state
    const [form, setForm] = useState({
        parentName: '',
        studentName: '',
        classId: '',
        className: '',
        term: 'FIRST',
        session: CURRENT_SESSION,
        notes: '',
        studentId: '',
    });

    // Fee items for letter composer ([{ feeLabel, category, originalAmount, discountPercent, isScholarship, isIncluded }])
    const [items, setItems] = useState([]);
    // Books toggle & amount
    const [includeBooks, setIncludeBooks] = useState(false);
    const [booksAmount, setBooksAmount] = useState('');
    // Preview
    const [preview, setPreview] = useState(null);
    // Student search
    const [studentSearch, setStudentSearch] = useState('');

    // Bulk mode state
    const [bulkClassId, setBulkClassId] = useState('');
    const [bulkTerm, setBulkTerm] = useState('FIRST');
    const [bulkSession, setBulkSession] = useState(CURRENT_SESSION);
    const [bulkNotes, setBulkNotes] = useState('');
    const [bulkItems, setBulkItems] = useState([]);
    const [bulkIncludeBooks, setBulkIncludeBooks] = useState(false);
    const [bulkBooksAmount, setBulkBooksAmount] = useState('');
    const [bulkResult, setBulkResult] = useState(null);

    // Queries
    const { data: classes = [] } = useQuery({
        queryKey: ['classes'],
        queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    });

    const { data: students = [] } = useQuery({
        queryKey: ['students-all'],
        queryFn: () => studentService.getAll().then(r => r.data.students || r.data || []),
    });

    const { data: letters = [], isLoading: lettersLoading } = useQuery({
        queryKey: ['bill-letters'],
        queryFn: () => billLetterService.getAll().then(r => r.data),
        enabled: mode === 'history',
    });

    const { data: settings } = useQuery({
        queryKey: ['school-settings'],
        queryFn: () => import('../../services/api').then(({ default: api }) => api.get('/settings').then(r => r.data)),
        placeholderData: { schoolName: 'PATIMO COLLEGE' },
    });

    const schoolName = settings?.schoolName || 'PATIMO COLLEGE';

    // Load class fee structures when class is selected
    const handleClassChange = useCallback(async (classId, isForBulk = false) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;

        if (!isForBulk) {
            setForm(f => ({ ...f, classId, className: cls.name }));
        } else {
            setBulkClassId(classId);
        }

        // Try to load DB fee structures, fall back to built-in defaults
        try {
            const res = await feeService.getStructures({ classId });
            const structs = res.data || [];
            if (structs.length > 0) {
                const loaded = structs.map((s, idx) => ({
                    feeLabel: s.description,
                    category: s.category || '',
                    originalAmount: s.amount,
                    discountPercent: 0,
                    isScholarship: false,
                    isIncluded: true,
                    sortOrder: s.sortOrder ?? idx,
                }));
                if (!isForBulk) setItems(loaded);
                else setBulkItems(loaded);
            } else {
                // No DB structures — use built-in defaults for this class
                const defaults = getDefaultsForClass(cls.name);
                if (!isForBulk) setItems(defaults);
                else setBulkItems(defaults);
                if (defaults.length > 0) toast.info(`Loaded default fees for ${cls.name}. Adjust as needed.`);
            }
        } catch {
            // On error, still apply defaults
            const defaults = getDefaultsForClass(cls.name);
            if (!isForBulk) setItems(defaults);
            else setBulkItems(defaults);
        }
    }, [classes]);

    const setItemField = (setter) => (idx, field, value) => {
        setter(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const updated = { ...item, [field]: value };
            // Recompute finalAmount (not stored in local state — computed on submit)
            return updated;
        }));
    };
    const updateItem = setItemField(setItems);
    const updateBulkItem = setItemField(setBulkItems);

    const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
    const removeBulkItem = (idx) => setBulkItems(prev => prev.filter((_, i) => i !== idx));

    const addCustomItem = (isForBulk = false) => {
        const newItem = { feeLabel: '', category: 'OTHER', originalAmount: '', discountPercent: 0, isScholarship: false, isIncluded: true };
        if (!isForBulk) setItems(prev => [...prev, newItem]);
        else setBulkItems(prev => [...prev, newItem]);
    };

    // Build payload items (compute finalAmount)
    const buildPayloadItems = (rawItems, incBooks, booksAmt) => {
        const all = rawItems.map(item => ({
            ...item,
            originalAmount: parseFloat(item.originalAmount) || 0,
            discountPercent: item.isScholarship ? 100 : parseFloat(item.discountPercent) || 0,
            finalAmount: item.isScholarship ? 0 : (parseFloat(item.originalAmount) || 0) * (1 - (parseFloat(item.discountPercent) || 0) / 100),
        }));
        if (incBooks && parseFloat(booksAmt) > 0) {
            all.push({
                feeLabel: 'Books / Notebooks',
                category: 'BOOKS',
                originalAmount: parseFloat(booksAmt),
                discountPercent: 0,
                isScholarship: false,
                finalAmount: parseFloat(booksAmt),
                isIncluded: true,
            });
        }
        return all;
    };

    // Mutations
    const { mutate: generateLetter, isPending: generating } = useMutation({
        mutationFn: (data) => billLetterService.generate(data),
        onSuccess: (res) => {
            toast.success('Fee letter generated!');
            setPreview(res.data.letter);
            qc.invalidateQueries({ queryKey: ['bill-letters'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to generate letter'),
    });

    const { mutate: generateBulk, isPending: generatingBulk } = useMutation({
        mutationFn: (data) => billLetterService.generateClass(data),
        onSuccess: (res) => {
            toast.success(`${res.data.count} letters generated!`);
            setBulkResult(res.data);
            qc.invalidateQueries({ queryKey: ['bill-letters'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Bulk generation failed'),
    });

    const { mutate: deleteLetter } = useMutation({
        mutationFn: (id) => billLetterService.delete(id),
        onSuccess: () => { toast.success('Letter deleted'); qc.invalidateQueries({ queryKey: ['bill-letters'] }); },
    });

    const handlePrint = useReactToPrint({ contentRef: printRef });

    const handleGenerate = () => {
        if (!form.parentName || !form.studentName || !form.classId) {
            return toast.warning('Please fill in parent name, student name, and select a class');
        }
        const payloadItems = buildPayloadItems(items, includeBooks, booksAmount);
        if (!payloadItems.length) return toast.warning('Add at least one fee item');

        generateLetter({
            parentName: form.parentName,
            studentName: form.studentName,
            className: form.className,
            classId: form.classId,
            studentId: form.studentId || undefined,
            term: form.term,
            session: form.session,
            notes: form.notes,
            items: payloadItems,
        });
    };

    const handleBulkGenerate = () => {
        if (!bulkClassId) return toast.warning('Please select a class');
        const payloadItems = buildPayloadItems(bulkItems, bulkIncludeBooks, bulkBooksAmount);
        if (!payloadItems.length) return toast.warning('Add at least one fee item');

        generateBulk({
            classId: bulkClassId,
            term: bulkTerm,
            session: bulkSession,
            notes: bulkNotes,
            items: payloadItems,
        });
    };

    // Student quick-link
    const filteredStudents = students.filter(s =>
        !studentSearch || `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) || s.admissionNo?.includes(studentSearch)
    ).slice(0, 8);

    // ItemsComposer and TabBtn are now defined at module level to prevent re-mount

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-header-title">Fee Letters</h1>
                    <p className="page-header-subtitle">Generate parent fee letters, apply discounts, and print in PDF format</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 4 }}>
                <TabBtn id="single" icon={FileText} label="Single Letter" activeMode={mode} onClick={setMode} />
                <TabBtn id="bulk" icon={Users} label="Bulk (Whole Class)" activeMode={mode} onClick={setMode} />
                <TabBtn id="history" icon={BookOpen} label="Letter History" activeMode={mode} onClick={setMode} />
            </div>

            {/* ── SINGLE LETTER MODE ───────────────────────────────── */}
            {mode === 'single' && (
                <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
                    {/* LEFT: Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Recipient Details */}
                        <div className="card">
                            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={18} style={{ color: 'var(--primary)' }} /> Recipient Details
                            </h3>

                            {/* Optional: Link to a registered student */}
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                                    <Search size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Quick-fill from registered student (optional)
                                </label>
                                <input
                                    className="form-input" placeholder="Search by name or admission no..."
                                    value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                                    style={{ fontSize: '0.88rem' }}
                                />
                                {studentSearch && (
                                    <div style={{ border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, background: 'var(--bg-surface)', maxHeight: 220, overflowY: 'auto' }}>
                                        {filteredStudents.length === 0 && (
                                            <div style={{ padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No students found</div>
                                        )}
                                        {filteredStudents.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => {
                                                    setForm(f => ({
                                                        ...f,
                                                        studentName: `${s.lastName} ${s.firstName}`,
                                                        parentName: s.parent?.name || f.parentName,
                                                        studentId: s.id,
                                                        classId: s.currentClassId || f.classId,
                                                        className: s.currentClass?.name || f.className,
                                                    }));
                                                    if (s.currentClassId) handleClassChange(s.currentClassId);
                                                    setStudentSearch('');
                                                }}
                                                style={{
                                                    padding: '8px 14px', cursor: 'pointer', fontSize: '0.88rem',
                                                    borderBottom: '1px solid var(--border-light)',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span>{s.lastName} {s.firstName}</span>
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.currentClass?.name || '—'} • {s.admissionNo}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Parent/Guardian Name <span className="required">*</span></label>
                                    <input className="form-input" placeholder="e.g. Mr. John Doe"
                                        value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Student Name <span className="required">*</span></label>
                                    <input className="form-input" placeholder="e.g. Doe Jane"
                                        value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Class <span className="required">*</span></label>
                                    <select className="form-select" value={form.classId}
                                        onChange={e => handleClassChange(e.target.value)}>
                                        <option value="">Select class...</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Term</label>
                                    <select className="form-select" value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))}>
                                        <option value="FIRST">First Term</option>
                                        <option value="SECOND">Second Term</option>
                                        <option value="THIRD">Third Term</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Session</label>
                                    <select className="form-select" value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))}>
                                        {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes (printed on letter)</label>
                                <input className="form-input" placeholder="e.g. Payment deadline: Oct 15th"
                                    value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>
                        </div>

                        {/* Fee Items */}
                        <div className="card">
                            <ItemsComposer
                                itemsList={items}
                                onUpdate={updateItem}
                                onRemove={removeItem}
                                onAdd={() => addCustomItem(false)}
                            />

                            {/* Books */}
                            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={includeBooks} onChange={e => setIncludeBooks(e.target.checked)} />
                                    <BookOpen size={16} style={{ color: 'var(--accent)' }} /> Include Books/Notebooks
                                </label>
                                {includeBooks && (
                                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Books Amount (₦):</label>
                                        <input className="form-input" type="number" style={{ width: 150 }}
                                            placeholder="e.g. 6500" value={booksAmount} onChange={e => setBooksAmount(e.target.value)} />
                                    </div>
                                )}
                            </div>

                            {/* Generate button */}
                            <button className="btn btn-primary btn-lg" style={{ marginTop: 20, width: '100%' }}
                                onClick={handleGenerate} disabled={generating}>
                                {generating ? (
                                    <span className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                                ) : <><FileText size={16} /> Generate & Preview Letter</>}
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Preview */}
                    {preview && (
                        <div style={{ position: 'sticky', top: 20 }}>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Letter Preview</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                                            <Printer size={14} /> Print / PDF
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ padding: 16, overflowY: 'auto', maxHeight: '75vh', background: '#f5f5f5' }}>
                                    <LetterPreview letter={preview} schoolName={schoolName} forwardRef={printRef} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── BULK CLASS MODE ──────────────────────────────────── */}
            {mode === 'bulk' && (
                <div style={{ maxWidth: 780 }}>
                    <div className="card">
                        <h3 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Users size={18} style={{ color: 'var(--primary)' }} /> Bulk Class Letter Generation
                        </h3>
                        <p className="text-sm text-muted mb-6">
                            Generate one fee letter per student for the entire class. Letters are saved to the history and can be printed individually or in batch.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Class <span className="required">*</span></label>
                                <select className="form-select" value={bulkClassId} onChange={e => handleClassChange(e.target.value, true)}>
                                    <option value="">Select class...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Term</label>
                                <select className="form-select" value={bulkTerm} onChange={e => setBulkTerm(e.target.value)}>
                                    <option value="FIRST">First Term</option>
                                    <option value="SECOND">Second Term</option>
                                    <option value="THIRD">Third Term</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Session</label>
                                <select className="form-select" value={bulkSession} onChange={e => setBulkSession(e.target.value)}>
                                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Class-wide Note</label>
                            <input className="form-input" placeholder="e.g. Fees must be paid before resumption"
                                value={bulkNotes} onChange={e => setBulkNotes(e.target.value)} />
                        </div>

                        <ItemsComposer
                            itemsList={bulkItems}
                            onUpdate={updateBulkItem}
                            onRemove={removeBulkItem}
                            onAdd={() => addCustomItem(true)}
                            showBulkNote={true}
                        />

                        {/* Books toggle */}
                        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                                <input type="checkbox" checked={bulkIncludeBooks} onChange={e => setBulkIncludeBooks(e.target.checked)} />
                                <BookOpen size={16} style={{ color: 'var(--accent)' }} /> Include Books/Notebooks
                            </label>
                            {bulkIncludeBooks && (
                                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Books Amount (₦):</label>
                                    <input className="form-input" type="number" style={{ width: 150 }}
                                        placeholder="e.g. 6500" value={bulkBooksAmount} onChange={e => setBulkBooksAmount(e.target.value)} />
                                </div>
                            )}
                        </div>

                        <button className="btn btn-primary btn-lg" style={{ marginTop: 20, width: '100%' }}
                            onClick={handleBulkGenerate} disabled={generatingBulk}>
                            {generatingBulk ? (
                                <span className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }} />
                            ) : <><Users size={16} /> Generate Letters for All Students in Class</>}
                        </button>

                        {bulkResult && (
                            <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--success)' }}>
                                <div style={{ color: 'var(--success)', fontWeight: 700, marginBottom: 8 }}>
                                    ✓ {bulkResult.message}
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Go to <strong>Letter History</strong> tab to view and print all generated letters.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── LETTER HISTORY ───────────────────────────────────── */}
            {mode === 'history' && (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Parent</th>
                                    <th>Class</th>
                                    <th>Term</th>
                                    <th>Session</th>
                                    <th>Total (₦)</th>
                                    <th>Date Generated</th>
                                    <th style={{ textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lettersLoading
                                    ? Array.from({ length: 4 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 8 }).map((_, j) => (
                                                <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                    : letters.map(letter => {
                                        const total = (letter.items || []).filter(i => i.isIncluded).reduce((s, i) => s + i.finalAmount, 0);
                                        return (
                                            <tr key={letter.id}>
                                                <td><strong>{letter.studentName}</strong></td>
                                                <td>{letter.parentName}</td>
                                                <td><span className="badge badge-info">{letter.className}</span></td>
                                                <td>{TERM_LABELS[letter.term] || letter.term}</td>
                                                <td>{letter.session}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(total)}</td>
                                                <td className="text-muted">{new Date(letter.createdAt).toLocaleDateString()}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => { setPreview(letter); setMode('single'); }}
                                                            title="View & Print"
                                                        >
                                                            <Eye size={12} /> View
                                                        </button>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            style={{ padding: '6px 8px' }}
                                                            onClick={() => { if (window.confirm('Delete this letter?')) deleteLetter(letter.id); }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                }
                                {!lettersLoading && letters.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                            No fee letters generated yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

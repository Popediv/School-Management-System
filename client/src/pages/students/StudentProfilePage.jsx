import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useState } from 'react';
import { studentService, feeService } from '../../services';
import { ArrowLeft, Edit, BookMarked, ClipboardCheck, CreditCard, Printer, Lock, Key, Plus, FileText, X, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';


const STATUS_COLORS = { ACTIVE:'success', SUSPENDED:'warning', GRADUATED:'info', WITHDRAWN:'danger' };

function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', borderBottom:'1px solid var(--border-light)', padding:'10px 0', gap:12 }}>
      <span style={{ width:160, flexShrink:0, fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>{value || '—'}</span>
    </div>
  );
}

export default function StudentProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'PRINCIPAL';
  const isBursary = user?.role === 'BURSARY' || user?.role === 'SUPER_ADMIN';

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusForm, setStatusForm] = useState('ACTIVE');
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', description: '', session: CURRENT_SESSION, term: 'FIRST' });

  const { mutate: createInvoice, isPending: creatingInvoice } = useMutation({
    mutationFn: (data) => feeService.createInvoice({ studentId: id, ...data }),
    onSuccess: () => {
      toast.success('Invoice created successfully');
      qc.invalidateQueries({ queryKey: ['student-fees', id] });
      setShowInvoiceModal(false);
      setInvoiceForm({ amount: '', description: '', session: CURRENT_SESSION, term: 'FIRST' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create invoice')
  });

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: (status) => api.put(`/students/${id}`, { status }),
    onSuccess: () => {
      toast.success('Student status updated');
      qc.invalidateQueries({ queryKey: ['student', id] });
      setShowStatusModal(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status')
  });

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentService.getById(id).then(r => r.data),
    placeholderData: {
      id, firstName:'Adaeze', lastName:'Okonkwo', otherNames:'Blessing',
      admissionNo:'GFM-2026-0001', moodleUsername:'gfm20260001',
      dateOfBirth:'2012-04-15', gender:'Female', status:'ACTIVE',
      stateOfOrigin:'Anambra', lga:'Onitsha', religion:'Christianity',
      bloodGroup:'O+', session:CURRENT_SESSION,
      currentClass:{ name:'JSS1A' },
      parent:{ name:'Mr. Emmanuel Okonkwo', phone:'+2348012345678', email:'e.okonkwo@gmail.com', address:'12 Unity Close, Onitsha' },
      photo: null
    }
  });

  const { data: feesData } = useQuery({
    queryKey: ['student-fees', id],
    queryFn: () => feeService.getStudentFees(id).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {[200,300,200].map((h,i) => <div key={i} className="skeleton card" style={{ height:h }}/>)}
    </div>
  );

  const initials = `${student.firstName[0]}${student.lastName[0]}`.toUpperCase();

  return (
    <div>
      {/* Back */}
      <Link to="/students" className="btn btn-secondary btn-sm mb-4" style={{ display:'inline-flex' }}>
        <ArrowLeft size={14}/> Back to Students
      </Link>

      {/* Profile header */}
      <div className="card mb-4">
        <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
          {/* Photo */}
          <div style={{
            width:96, height:112, borderRadius:'var(--radius-md)',
            background:'linear-gradient(135deg,var(--primary),var(--secondary))',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'1.8rem', fontWeight:700, color:'white', flexShrink:0,
            overflow:'hidden'
          }}>
            {student.photo
              ? <img src={student.photo.startsWith('http') ? student.photo : `/uploads/${student.photo}`} alt="passport" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : initials
            }
          </div>

          {/* Info */}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div>
                <h2 style={{ marginBottom:4 }}>{student.lastName} {student.firstName} {student.otherNames}</h2>
                <code style={{ fontSize:'0.9rem', color:'var(--primary-light)', background:'rgba(79,70,229,0.1)', padding:'2px 10px', borderRadius:99 }}>
                  {student.admissionNo}
                </code>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <span className={`badge badge-${STATUS_COLORS[student.status]}`}>{student.status}</span>
                <Link to={`/students/${id}/edit`} className="btn btn-secondary btn-sm"><Edit size={14}/> Edit</Link>
                {isAdmin && (
                  <>
                    <button onClick={() => { setStatusForm(student.status); setShowStatusModal(true); }} className="btn btn-secondary btn-sm" style={{ border: '1px solid var(--border)' }}>
                      <Activity size={14}/> Update Status
                    </button>
                    <Link to={`/students/${id}/admission-letter`} className="btn btn-primary btn-sm">
                      <Printer size={14}/> Admission Letter
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:16, marginTop:12, flexWrap:'wrap' }}>
              <span className="text-sm text-muted">Class: <strong className="text-primary">{student.currentClass?.name}</strong></span>
              <span className="text-sm text-muted">Session: <strong className="text-primary">{student.session}</strong></span>
              <span className="text-sm text-muted">Moodle: <code style={{ color:'var(--secondary)', fontSize:'0.8rem' }}>{student.moodleUsername}</code></span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <Link to={`/results/report-card/${id}`} className="btn btn-secondary btn-sm"><BookMarked size={14}/> Report Card</Link>
        <Link to={`/attendance/report?student=${id}`} className="btn btn-secondary btn-sm"><ClipboardCheck size={14}/> Attendance</Link>
        <a href="#fees-section" className="btn btn-secondary btn-sm"><CreditCard size={14}/> Fee Records</a>
        <Link to={`/idcards?student=${id}`} className="btn btn-secondary btn-sm">🪪 ID Card</Link>
      </div>

      <div className="grid-2">
        {/* Bio Data */}
        <div className="card">
          <h3 className="mb-2">Personal Information</h3>
          <InfoRow label="First Name"     value={student.firstName} />
          <InfoRow label="Last Name"      value={student.lastName} />
          <InfoRow label="Other Names"    value={student.otherNames} />
          <InfoRow label="Date of Birth"  value={student.dateOfBirth?.slice(0,10)} />
          <InfoRow label="Gender"         value={student.gender} />
          <InfoRow label="Blood Group"    value={student.bloodGroup} />
          <InfoRow label="Religion"       value={student.religion} />
          <InfoRow label="State of Origin" value={student.stateOfOrigin} />
          <InfoRow label="LGA"            value={student.lga} />
        </div>

        {/* Parent */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="card">
            <h3 className="mb-2">Parent / Guardian</h3>
            <InfoRow label="Name"           value={student.parent?.name} />
            <InfoRow label="Phone"          value={student.parent?.phone} />
            <InfoRow label="Email"          value={student.parent?.email} />
            <InfoRow label="Address"        value={student.parent?.address} />
          </div>

          {/* Moodle Credentials */}
          {isAdmin && (
            <div className="card" style={{ borderColor: 'var(--primary-light)' }}>
              <h3 className="mb-2" style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Lock size={18} style={{ color:'var(--primary)' }}/> Login Credentials (Admin)
              </h3>
              <p className="text-sm text-muted mb-4">
                These details are used to log into the Student Portal and Moodle E-Learning.
              </p>
              <InfoRow label="Portal Email" value={student.user?.email || `${student.moodleUsername}@school.local`} />
              <InfoRow label="Moodle Username" value={student.moodleUsername} />
              <InfoRow label="Plain Password" value={
                <code style={{ background:'var(--bg-body)', padding:'4px 8px', borderRadius:4, color:'var(--text-primary)' }}>
                  {student.moodlePassword || 'N/A'}
                </code>
              } />
              {user?.role === 'SUPER_ADMIN' && student.user?.id && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <Link to={`/admin-reset/${student.user.id}`} className="btn btn-danger btn-sm" style={{ display: 'inline-flex' }}>
                    <Key size={14} /> Reset Password
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fee Records */}
      {(isAdmin || isBursary) && feesData && (
        <div id="fees-section" className="card mt-6" style={{ padding:0 }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Fee Statements</h3>
            <button onClick={() => setShowInvoiceModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14}/> Manual Invoice
            </button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr>
                <th>Date</th><th>Description</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th>
              </tr></thead>
              <tbody>
                {(feesData.payments || []).map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td><strong>{p.description}</strong></td>
                    <td>₦{p.amount?.toLocaleString()}</td>
                    <td className="text-success">₦{p.amountPaid?.toLocaleString()}</td>
                    <td className={(p.amount - (p.amountPaid || 0)) > 0 ? "text-danger font-semibold" : "text-muted"}>₦{(p.amount - (p.amountPaid || 0))?.toLocaleString()}</td>
                    <td><span className={`badge ${p.status === 'PAID' ? 'badge-success' : p.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>{p.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {p.status !== 'PAID' && (
                          <Link to={`/fees/pay/${p.id}`} className="btn btn-primary btn-sm" style={{ padding: '4px 8px' }}>Pay</Link>
                        )}
                        {p.status !== 'PENDING' && (
                          <Link to={`/fees/receipt/${p.id}`} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>Receipt</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!feesData.payments || feesData.payments.length === 0) && (
                  <tr><td colSpan="7" className="text-center text-muted py-8">No fee records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Invoice Modal */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-slide-up" style={{ width: '90%', maxWidth: 450, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={18} style={{ color: 'var(--primary)' }}/> Create Manual Invoice</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="btn btn-secondary btn-icon"><X size={18} /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); createInvoice(invoiceForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Fee Description <span className="required">*</span></label>
                <input required className="form-input" placeholder="e.g. Excursion Fee, Broken Desk Fine" value={invoiceForm.description} onChange={e => setInvoiceForm({...invoiceForm, description: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Amount (₦) <span className="required">*</span></label>
                <input required type="number" min="1" className="form-input" placeholder="e.g. 5000" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} />
              </div>
              
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Term</label>
                  <select className="form-select" value={invoiceForm.term} onChange={e => setInvoiceForm({...invoiceForm, term: e.target.value})}>
                    <option value="FIRST">First Term</option>
                    <option value="SECOND">Second Term</option>
                    <option value="THIRD">Third Term</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Session</label>
                  <select className="form-select" value={invoiceForm.session} onChange={e => setInvoiceForm({...invoiceForm, session: e.target.value})}>
                    {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowInvoiceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creatingInvoice}>
                  {creatingInvoice ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/> : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Status Update Modal */}
      {showStatusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-slide-up" style={{ width: '90%', maxWidth: 400, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} style={{ color: 'var(--primary)' }}/> Update Student Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="btn btn-secondary btn-icon"><X size={18} /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); updateStatus(statusForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Student Status <span className="required">*</span></label>
                <select className="form-select" value={statusForm} onChange={e => setStatusForm(e.target.value)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="WITHDRAWN">WITHDRAWN</option>
                  <option value="GRADUATED">GRADUATED</option>
                </select>
                <p className="text-sm text-muted" style={{ marginTop: 6 }}>
                  Changing the status to Suspend or Withdrawn will flag their profile and may restrict their portal access depending on role settings.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={updatingStatus}>
                  {updatingStatus ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/> : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

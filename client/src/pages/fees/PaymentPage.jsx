import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { feeService, studentService } from '../../services';
import { CreditCard, ArrowLeft, Printer, CheckCircle } from 'lucide-react';

const fmt = n => `₦${Number(n).toLocaleString()}`;

const FEE_TYPES = ['School Fees','Development Levy','Library/ICT Levy','Sports Levy','Exam Levy','Other'];

export default function PaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({ amount:'', method:'Cash', reference:'', note:'' });
  const [receipt, setReceipt] = useState(null);

  const { data: paymentData, isLoading } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => feeService.getReceipt(paymentId).then(r => r.data.receipt),
    enabled: !!paymentId,
  });

  const student = paymentData?.student;
  const balance = paymentData ? (paymentData.amount - (paymentData.amountPaid || 0)) : 0;

  const outstandingFees = paymentData ? [{
      id: paymentData.id,
      type: paymentData.description,
      amount: paymentData.amount,
      balance: balance,
      status: paymentData.status === 'PENDING' ? 'UNPAID' : paymentData.status
  }] : [];

  const { mutate: pay, isPending } = useMutation({
    mutationFn: (data) => feeService.recordPayment(data),
    onSuccess: (res) => {
      const updatedPayment = res?.data?.payment;
      setReceipt({
        ...updatedPayment,
        studentName: student ? `${student.lastName} ${student.firstName}` : '',
        admissionNo: student?.admissionNo,
        class: student?.currentClass?.name,
        feeType: paymentData?.description,
        amountPaidThisTime: form.amount,
        paymentMethod: form.method,
        reference: form.reference,
        date: new Date().toLocaleDateString(),
      });
      qc.invalidateQueries({ queryKey: ['fees-outstanding'] });
      qc.invalidateQueries({ queryKey: ['payment', paymentId] });
      toast.success('Payment recorded successfully!');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Payment failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0 || Number(form.amount) > balance)
      return toast.warning(`Enter a valid amount up to ${fmt(balance)}`);
    pay({
      paymentId: paymentId,
      amountPaid: parseFloat(form.amount),
      paymentMethod: form.method,
      reference: form.reference,
      note: form.note,
    });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* Receipt View */
  if (receipt) {
    return (
      <div>
        <div className="page-header">
          <div><h1 className="page-header-title">Payment Receipt</h1></div>
          <button onClick={() => window.print()} className="btn btn-secondary"><Printer size={16}/> Print Receipt</button>
        </div>
        <div className="card" style={{ maxWidth:500 }}>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <CheckCircle size={28} style={{ color:'var(--success)' }}/>
            </div>
            <h2 style={{ marginBottom:4 }}>Payment Confirmed</h2>
            <p className="text-muted">Receipt No: <code style={{ color:'var(--primary-light)' }}>{receipt.receiptNo || `REC-${Date.now()}`}</code></p>
          </div>
          <div className="divider"/>
          {[
            ['Student', `${student.lastName} ${student.firstName}`],
            ['Admission No.', student.admissionNo],
            ['Class', student.currentClass?.name],
            ['Fee Type', receipt.feeType],
            ['Amount Paid', fmt(receipt.amountPaidThisTime)],
            ['Payment Method', receipt.paymentMethod],
            ['Reference', receipt.reference || '—'],
            ['Date', receipt.date],
          ].map(([label, value]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-light)' }}>
              <span className="text-sm text-muted">{label}</span>
              <span className="text-sm font-semibold text-primary">{value}</span>
            </div>
          ))}
          <div className="divider"/>
          <div style={{ display:'flex', gap:12, marginTop:8 }}>
            <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => window.print()}>
              Print Again
            </button>
            <Link to="/fees" className="btn btn-primary" style={{ flex:1 }}>
              Back to Fees
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (!student) return <div className="p-8 text-center text-muted">Loading student details...</div>;
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Record Payment</h1>
          <p className="page-header-subtitle">Record a fee payment and generate a receipt</p>
        </div>
        <Link to="/fees" className="btn btn-secondary"><ArrowLeft size={16}/> Back to Fees</Link>
      </div>

      <div className="grid-2" style={{ alignItems:'start' }}>
        {/* Student Info */}
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Student Information</h3>
          {[
            ['Name',         `${student.lastName} ${student.firstName}`],
            ['Admission No.',student.admissionNo],
            ['Class',        student.currentClass?.name],
            ['Session',      student.session],
          ].map(([label, value]) => (
            <div key={label} style={{ display:'flex', borderBottom:'1px solid var(--border-light)', padding:'9px 0', gap:12 }}>
              <span style={{ width:130, flexShrink:0, fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:500 }}>{label}</span>
              <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>{value || '—'}</span>
            </div>
          ))}

          {/* Outstanding Fees */}
          {outstandingFees.length > 0 && (
            <>
              <h4 style={{ marginTop:20, marginBottom:10, fontSize:'0.9rem' }}>Outstanding Balances</h4>
              {outstandingFees.map(f => (
                <div key={f.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:'var(--radius-sm)', background:'var(--bg-elevated)', marginBottom:6 }}>
                  <span className="text-sm">{f.type}</span>
                  <span className="text-sm font-semibold" style={{ color: f.status === 'UNPAID' ? 'var(--danger)' : 'var(--accent)' }}>
                    {fmt(f.balance)} <span className={`badge badge-${f.status === 'UNPAID' ? 'danger' : 'warning'}`} style={{ marginLeft:6 }}>{f.status}</span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Payment Form */}
        <div className="card">
          <h3 style={{ marginBottom:20 }}>Payment Details</h3>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="form-group">
              <label className="form-label">Fee Type</label>
              <input className="form-input" disabled value={paymentData?.description || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₦) <span className="required">*</span></label>
              <input className="form-input" type="number" min="1" placeholder="e.g. 45000" value={form.amount} onChange={e => set('amount', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-select" value={form.method} onChange={e => set('method', e.target.value)}>
                {['Cash','Bank Transfer','POS','Cheque','Online'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reference / Teller No.</label>
              <input className="form-input" placeholder="Bank teller or transaction ref" value={form.reference} onChange={e => set('reference', e.target.value)}/>
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea className="form-textarea" placeholder="Optional note" style={{ minHeight:70 }} value={form.note} onChange={e => set('note', e.target.value)}/>
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={isPending}>
              {isPending
                ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
                : <><CreditCard size={18}/> Record Payment</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

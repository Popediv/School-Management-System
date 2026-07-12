import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { feeService } from '../../services';
import { Printer, ArrowLeft, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const fmt = n => `₦${Number(n || 0).toLocaleString()}`;

export default function ReceiptViewPage() {
  const { paymentId } = useParams();

  const { data: receipt, isLoading, isError } = useQuery({
    queryKey: ['receipt', paymentId],
    queryFn: () => feeService.getReceipt(paymentId).then(r => r.data.receipt),
    enabled: !!paymentId,
  });

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading receipt details...</div>;
  if (isError || !receipt) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Failed to load receipt or receipt not found.</div>;

  const student = receipt.student;
  const outstanding = (receipt.amount || 0) - (receipt.amountPaid || 0);

  const rows = [
    ['Student Name',       `${student?.lastName || ''} ${student?.firstName || ''}`],
    ['Admission No.',      student?.admissionNo || '—'],
    ['Class / Session',   `${student?.currentClass?.name || '—'} (${receipt.session || '—'})`],
    ['Fee Description',    receipt.description || '—'],
    ['Total Fee Amount',   fmt(receipt.amount)],
    ['Amount Paid',        fmt(receipt.amountPaid)],
    ['Outstanding Balance',fmt(outstanding)],
    ['Payment Method',     receipt.paymentMethod || '—'],
    ['Transaction Ref',    receipt.reference || '—'],
    ['Date Paid',          receipt.paidAt
      ? new Date(receipt.paidAt).toLocaleString('en-GB', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—'],
    ['Payment Status',     receipt.status || '—'],
  ];

  return (
    <>
      <style>{`
        @media print {
          body, html { margin: 0; padding: 0; }
          body * { visibility: hidden !important; }
          #printable-receipt,
          #printable-receipt * { visibility: visible !important; }
          #printable-receipt {
            position: fixed;
            inset: 0;
            width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            padding: 18mm 20mm;
            margin: 0 auto;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: hidden;
            background: #fff !important;
            color: #000 !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Screen toolbar — hidden on print via CSS above */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Payment Receipt</h1>
          <p className="page-header-subtitle">Receipt No: <strong>{receipt.receiptNo}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={16} /> Print / Save PDF
          </button>
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>

      {/* Receipt card */}
      <div id="printable-receipt" className="card" style={{ maxWidth: 640, margin: '0 auto', background: '#fff', color: '#000' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28, borderBottom: '2px dashed #e2e8f0', paddingBottom: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <CheckCircle size={28} style={{ color: '#16a34a' }} />
          </div>
          <h2 style={{ margin: '0 0 6px', color: '#16a34a', fontSize: '1.2rem', fontWeight: 700 }}>PAYMENT RECEIPT</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Patimo College School Management System</p>
          <div style={{ marginTop: 10, display: 'inline-block', background: '#f8fafc', padding: '4px 14px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: 6 }}>Receipt No:</span>
            <code style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{receipt.receiptNo}</code>
          </div>
        </div>

        {/* Verification QR Code */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <QRCodeSVG 
            value={`${window.location.origin}/fees/receipt/${receipt.id}`} 
            size={80} 
            level="M" 
            includeMargin={true} 
            style={{ margin: '0 auto', display: 'block' }}
          />
          <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Scan QR to verify authenticity</p>
        </div>

        {/* Rows */}
        <div style={{ display: 'grid', gap: 2 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{label}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: '2px dashed #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
          <p style={{ margin: '0 0 4px' }}>Thank you for your payment.</p>
          <p style={{ margin: 0 }}>For enquiries, contact the Bursary department.</p>
          <p style={{ marginTop: 12, fontSize: '0.72rem', fontStyle: 'italic' }}>Printed on: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </>
  );
}

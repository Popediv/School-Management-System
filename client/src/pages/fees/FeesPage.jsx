import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { feeService, classService } from '../../services';
import { toast } from 'react-toastify';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';
import { 
  CreditCard, Search, AlertCircle, CheckCircle, 
  Clock, Settings, Zap, Trash2, Plus, Landmark, Printer
} from 'lucide-react';

const fmt = n => `₦${Number(n).toLocaleString()}`;
const STATUS_BADGE = { UNPAID:'badge-danger', PARTIAL:'badge-warning', PAID:'badge-success' };

export default function FeesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('outstanding'); // 'outstanding' | 'templates' | 'bulk'
  
  // Search & Filters for Tab 1
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form states for Tab 2 (Fee Structures)
  const [structForm, setStructForm] = useState({ classId: '', description: '', amount: '', term: 'FIRST', session: CURRENT_SESSION });
  
  // Form states for Tab 3 (Bulk Invoicing)
  const [bulkForm, setBulkForm] = useState({ classId: '', term: 'FIRST', session: CURRENT_SESSION });
  const [bulkResult, setBulkResult] = useState(null);

  // Queries
  const { data: outstandingData = {}, isLoading: outstandingLoading } = useQuery({
    queryKey: ['fees-outstanding'],
    queryFn: () => feeService.getOutstanding().then(r => r.data),
    placeholderData: { summary: {}, outstanding: [] },
  });

  const { data: structures = [], isLoading: structuresLoading } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => feeService.getStructures().then(r => r.data),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
  });

  // Mutations
  const { mutate: saveStructure, isPending: savingStructure } = useMutation({
    mutationFn: (data) => feeService.createStructure(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success('Fee configuration saved successfully!');
      setStructForm(prev => ({ ...prev, description: '', amount: '' })); // clear descriptive fields
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save fee structure'),
  });

  const { mutate: deleteStructure, isPending: deletingStructure } = useMutation({
    mutationFn: (id) => feeService.deleteStructure(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success('Fee configuration deleted.');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete configuration'),
  });

  const { mutate: runBulkBilling, isPending: billingInProgress } = useMutation({
    mutationFn: (data) => feeService.bulkInvoice(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['fees-outstanding'] });
      setBulkResult(res.data);
      toast.success('Bulk billing completed successfully!');
    },
    onError: (err) => {
      setBulkResult(null);
      toast.error(err.response?.data?.message || 'Bulk billing failed. Check if class has active templates.');
    },
  });

  // Handlers
  const handleSaveStructure = (e) => {
    e.preventDefault();
    if (!structForm.classId || !structForm.description || !structForm.amount) {
      return toast.warning('Please fill in all fee configuration fields');
    }
    saveStructure({
      classId: structForm.classId,
      description: structForm.description,
      amount: parseFloat(structForm.amount),
      term: structForm.term,
      session: structForm.session
    });
  };

  const handleBulkInvoice = (e) => {
    e.preventDefault();
    if (!bulkForm.classId || !bulkForm.term || !bulkForm.session) {
      return toast.warning('Please select a class, term, and session to bill');
    }
    setBulkResult(null);
    runBulkBilling(bulkForm);
  };

  const filteredOutstanding = (outstandingData.outstanding || []).filter(r => {
    const matchSearch = !search || r.studentName.toLowerCase().includes(search.toLowerCase()) || r.admissionNo.includes(search);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .page-header, .page-header *, .tabs-container { display: none !important; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { position: absolute; left: 0; top: 0; width: 100%; }
          .btn, .search-bar, select { display: none !important; }
          .grid-stat { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 10px; margin-bottom: 20px; }
          .stat-card { border: 1px solid #ddd; box-shadow: none; padding: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          @page { size: landscape; }
        }
      `}</style>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Fees & Bursary</h1>
          <p className="page-header-subtitle">Manage dynamic fee configurations, payments, receipts, and class bulk invoicing</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 12 }}>
        <button 
          onClick={() => setActiveTab('outstanding')} 
          style={{
            padding: '12px 20px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none',
            color: activeTab === 'outstanding' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'outstanding' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
          }}
        >
          <Landmark size={16} /> Outstanding & Payments
        </button>
        <button 
          onClick={() => setActiveTab('templates')} 
          style={{
            padding: '12px 20px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none',
            color: activeTab === 'templates' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'templates' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
          }}
        >
          <Settings size={16} /> Configure School Fees
        </button>
        <button 
          onClick={() => setActiveTab('bulk')} 
          style={{
            padding: '12px 20px', fontSize: '0.9rem', fontWeight: 600, border: 'none', background: 'none',
            color: activeTab === 'bulk' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'bulk' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
          }}
        >
          <Zap size={16} /> Bulk Bill Class
        </button>
      </div>

      {/* Tab 1: Outstanding & Payments */}
      {activeTab === 'outstanding' && (
        <div id="printable-report">
          <div style={{ display: 'none' }} className="print-only-header">
            <h2 style={{ textAlign: 'center', marginBottom: 20 }}>Fees & Outstanding Report</h2>
            <p style={{ textAlign: 'center', marginBottom: 20 }}>Generated on: {new Date().toLocaleString()}</p>
          </div>
          {/* Summary Stats */}
          <div className="grid-stat mb-6">
            <div className="stat-card">
              <div className="stat-icon red"><AlertCircle size={22}/></div>
              <div>
                <div className="stat-value" style={{ fontSize:'1.3rem' }}>{fmt(outstandingData.summary?.totalOutstanding || 0)}</div>
                <div className="stat-label">Total Outstanding</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon amber"><Clock size={22}/></div>
              <div>
                <div className="stat-value">{outstandingData.summary?.totalStudents || 0}</div>
                <div className="stat-label">Students with Balance</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><CheckCircle size={22}/></div>
              <div>
                <div className="stat-value">{outstandingData.summary?.fullyPaid || 0}</div>
                <div className="stat-label">Fully Paid</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon cyan"><CreditCard size={22}/></div>
              <div>
                <div className="stat-value">{outstandingData.summary?.partialPaid || 0}</div>
                <div className="stat-label">Partial Payments</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card mb-4" style={{ padding:'16px 20px' }}>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
              <div className="search-bar" style={{ flex:1, minWidth:200 }}>
                <Search size={16}/>
                <input className="form-input" placeholder="Search student name or admission number…" value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select className="form-select" style={{ width:160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="PAID">Paid</option>
              </select>
              <button className="btn btn-secondary" onClick={() => window.print()} style={{ marginLeft: 'auto' }}>
                <Printer size={16} /> Generate Report
              </button>
            </div>
          </div>

          {/* Outstanding Table */}
          <div className="card" style={{ padding:0 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Fee Type</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingLoading ? (
                    Array.from({length:4}).map((_,i) => (
                      <tr key={i}>
                        {Array.from({length:8}).map((_,j) => (
                          <td key={j}><div className="skeleton" style={{height:14,width:'80%'}}/></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredOutstanding.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.studentName}</strong></td>
                      <td><code style={{ fontSize:'0.78rem', color:'var(--primary-light)' }}>{r.admissionNo}</code></td>
                      <td>{r.class}</td>
                      <td>{r.type}</td>
                      <td style={{ fontWeight:600 }}>{fmt(r.amount)}</td>
                      <td style={{ fontWeight:600, color: r.status === 'UNPAID' ? 'var(--danger)' : 'var(--accent)' }}>{fmt(r.balance)}</td>
                      <td className="text-muted">{r.dueDate}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status] || 'badge-muted'}`}>{r.status}</span></td>
                      <td>
                        <Link to={`/fees/pay/${r.id}`} className="btn btn-primary btn-sm">
                          <CreditCard size={12}/> Pay
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {!outstandingLoading && filteredOutstanding.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                        No outstanding invoices match your search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Configure School Fees (Templates) */}
      {activeTab === 'templates' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* List Configurations */}
          <div className="card">
            <h3 className="mb-4">Active Fee Templates</h3>
            <p className="text-xs text-muted mb-4">
              Configure global fee templates by class, term, and academic session. When you run class bulk billing, these structures will determine student bills.
            </p>
            
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Term</th>
                    <th>Session</th>
                    <th>Fee Description</th>
                    <th>Amount</th>
                    <th style={{ textAlign: 'center' }}>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {structuresLoading ? (
                    Array.from({length:3}).map((_,i) => (
                      <tr key={i}>
                        {Array.from({length:6}).map((_,j) => (
                          <td key={j}><div className="skeleton" style={{height:14,width:'70%'}}/></td>
                        ))}
                      </tr>
                    ))
                  ) : structures.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.class?.name}</strong></td>
                      <td><span className="badge badge-info">{s.term}</span></td>
                      <td>{s.session}</td>
                      <td>{s.description}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(s.amount)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the ${s.description} template for ${s.class?.name}?`)) {
                              deleteStructure(s.id);
                            }
                          }}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '6px 8px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!structuresLoading && structures.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding:32, color: 'var(--text-muted)' }}>
                        No fee structures configured yet. Please configure standard fee amounts on the right.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Configuration Form */}
          <div className="card">
            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Plus size={18} style={{ color: 'var(--primary)' }} /> Configure Fee Template</h3>
            <form onSubmit={handleSaveStructure} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div className="form-group">
                <label className="form-label">Target Class <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={structForm.classId} 
                  onChange={e => setStructForm(prev => ({ ...prev, classId: e.target.value }))}
                >
                  <option value="">Select Target Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Academic Term <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={structForm.term} 
                  onChange={e => setStructForm(prev => ({ ...prev, term: e.target.value }))}
                >
                  <option value="FIRST">First Term</option>
                  <option value="SECOND">Second Term</option>
                  <option value="THIRD">Third Term</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Academic Session <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={structForm.session} 
                  onChange={e => setStructForm(prev => ({ ...prev, session: e.target.value }))}
                >
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Fee Description / Item Name <span className="required">*</span></label>
                <input 
                  className="form-input" 
                  type="text" 
                  placeholder="e.g. Tuition Fee, Development Levy, Exam Fee" 
                  value={structForm.description} 
                  onChange={e => setStructForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Standard Amount (₦) <span className="required">*</span></label>
                <input 
                  className="form-input" 
                  type="number" 
                  placeholder="e.g. 45000" 
                  value={structForm.amount} 
                  onChange={e => setStructForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={savingStructure}>
                {savingStructure
                  ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
                  : 'Save Configuration Template'
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Bulk Bill Class */}
      {activeTab === 'bulk' && (
        <div style={{ maxWidth: 650, margin: '0 auto' }}>
          <div className="card">
            <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={18} style={{ color: 'var(--primary)' }} /> Bulk Class Invoicing</h3>
            <p className="text-sm text-muted mb-6">
              Generate pending invoices automatically for all students enrolled in a selected class. This will charge them according to the standard fee configurations configured under <strong>Configure School Fees</strong>.
            </p>

            <form onSubmit={handleBulkInvoice} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Select Class to Bill <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={bulkForm.classId} 
                  onChange={e => setBulkForm(prev => ({ ...prev, classId: e.target.value }))}
                >
                  <option value="">Choose Class...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Billing Term <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={bulkForm.term} 
                  onChange={e => setBulkForm(prev => ({ ...prev, term: e.target.value }))}
                >
                  <option value="FIRST">First Term</option>
                  <option value="SECOND">Second Term</option>
                  <option value="THIRD">Third Term</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Academic Session <span className="required">*</span></label>
                <select 
                  className="form-select" 
                  value={bulkForm.session} 
                  onChange={e => setBulkForm(prev => ({ ...prev, session: e.target.value }))}
                >
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 8 }} disabled={billingInProgress}>
                {billingInProgress ? (
                  <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
                ) : (
                  <><Zap size={16} /> Run Bulk Billing Generator</>
                )}
              </button>
            </form>

            {bulkResult && (
              <div 
                style={{ 
                  marginTop: 24, padding: '16px 20px', borderRadius: 'var(--radius-md)', 
                  background: 'var(--bg-elevated)', border: '1px solid var(--success)' 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success)', fontWeight: 700, fontSize: '0.95rem', marginBottom: 12 }}>
                  <CheckCircle size={20} />
                  <span>{bulkResult.message}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'var(--bg-body)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Invoices Created</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-light)' }}>{bulkResult.summary?.invoicesGenerated}</div>
                  </div>
                  <div style={{ background: 'var(--bg-body)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Students Billed</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{bulkResult.summary?.studentsBilled}</div>
                  </div>
                  <div style={{ background: 'var(--bg-body)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>Skipped Duplicates</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-muted)' }}>{bulkResult.summary?.skippedDuplicates}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 20, border: '1px solid var(--border-light)', background: 'transparent' }}>
            <h4 className="mb-2" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}><AlertCircle size={16} style={{ color: 'var(--primary)' }} /> ERP Invoicing Rules</h4>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
              <li>Students must be enrolled in the target class and marked as <strong>Active</strong>.</li>
              <li>You must first configure at least one fee template for this class under the <strong>Configure School Fees</strong> tab.</li>
              <li>Re-running bulk billing is 100% safe. The engine automatically filters out existing invoices to prevent double charging.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

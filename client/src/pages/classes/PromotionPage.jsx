import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { classService } from '../../services';
import { TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';

export default function PromotionPage() {
  const [fromClass, setFromClass] = useState('');
  const [toClass, setToClass]     = useState('');
  const [session, setSession]     = useState(CURRENT_SESSION);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [
      { id:'c1', name:'JSS1A', _count:{ students:38 } },
      { id:'c2', name:'JSS2A', _count:{ students:35 } },
      { id:'c3', name:'JSS3A', _count:{ students:32 } },
      { id:'c4', name:'SS1A',  _count:{ students:30 } },
      { id:'c5', name:'SS2A',  _count:{ students:28 } },
    ],
  });

  const fromInfo = classes.find(c => c.id === fromClass);
  const toInfo = toClass === 'GRADUATE' 
    ? { id: 'GRADUATE', name: 'Alumni (Graduated)' } 
    : classes.find(c => c.id === toClass);

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!fromClass || !toClass) return toast.warning('Please select both classes');
    if (fromClass === toClass)  return toast.warning('From and To classes cannot be the same');
    if (!confirmed)             return toast.warning('Please confirm the promotion by checking the box');

    setLoading(true);
    try {
      const res = await api.post('/students/bulk-promote', { fromClassId: fromClass, toClassId: toClass, session });
      setResult({ count: res.data.count || fromInfo?._count?.students || '?', toClass: toInfo?.name });
      toast.success('Students promoted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Promotion failed');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Student Promotion</h1>
            <p className="page-header-subtitle">Promote students from one class to the next</p>
          </div>
        </div>
        <div className="card" style={{ maxWidth:500, textAlign:'center', padding:48 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <TrendingUp size={28} style={{ color:'var(--success)' }}/>
          </div>
          <h2 style={{ marginBottom:8 }}>Promotion Successful!</h2>
          <p className="text-muted" style={{ marginBottom:24 }}>
            <strong className="text-primary">{result.count}</strong> students have been successfully moved to <strong className="text-primary">{result.toClass}</strong> for the <strong>{session}</strong> session.
          </p>
          <button className="btn btn-secondary" onClick={() => { setResult(null); setConfirmed(false); setFromClass(''); setToClass(''); }}>
            Promote Another Class
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Student Promotion</h1>
          <p className="page-header-subtitle">Bulk-promote students from one class to the next</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
        {/* Form */}
        <div className="card">
          <h3 style={{ marginBottom:20 }}>Promotion Settings</h3>
          <form onSubmit={handlePromote} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="form-group">
              <label className="form-label">Academic Session <span className="required">*</span></label>
              <select className="form-select" value={session} onChange={e => setSession(e.target.value)}>
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">From Class <span className="required">*</span></label>
              <select className="form-select" value={fromClass} onChange={e => setFromClass(e.target.value)}>
                <option value="">Select current class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c._count?.students || 0} students)</option>)}
              </select>
            </div>
            <div style={{ display:'flex', justifyContent:'center' }}>
              <ArrowRight size={20} style={{ color:'var(--text-muted)' }}/>
            </div>
            <div className="form-group">
              <label className="form-label">To Class <span className="required">*</span></label>
              <select className="form-select" value={toClass} onChange={e => setToClass(e.target.value)}>
                <option value="">Select next class…</option>
                {classes.filter(c => c.id !== fromClass).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="GRADUATE" style={{ fontWeight: 'bold', color: 'var(--success)' }}>🌟 Graduate Students</option>
              </select>
            </div>

            {/* Warning */}
            <div className="alert alert-warning" style={{ marginTop:4 }}>
              <AlertTriangle size={16} style={{ flexShrink:0, marginTop:2 }}/>
              <div>
                <strong>Warning:</strong> This will move <em>all students</em> in {fromInfo?.name || 'the selected class'} to {toInfo?.name || 'the target class'}. {toClass === 'GRADUATE' ? 'They will no longer be active students.' : 'This action cannot be undone.'}
              </div>
            </div>

            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                style={{ width:16, height:16, accentColor:'var(--primary)' }}
              />
              I understand and confirm this promotion
            </label>

            <button type="submit" className="btn btn-danger btn-lg" disabled={loading || !confirmed}>
              {loading
                ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
                : <><TrendingUp size={18}/> Promote Students</>
              }
            </button>
          </form>
        </div>

        {/* Preview */}
        <div className="card">
          <h3 style={{ marginBottom:16 }}>Promotion Preview</h3>
          {fromClass && toClass
            ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ padding:'14px 18px', borderRadius:'var(--radius-md)', background:'rgba(79,70,229,0.08)', border:'1px solid rgba(79,70,229,0.2)' }}>
                  <div className="text-xs text-muted mb-1">FROM</div>
                  <div className="font-semibold text-primary" style={{ fontSize:'1.1rem' }}>{fromInfo?.name}</div>
                  <div className="text-sm text-muted">{fromInfo?._count?.students || '?'} students will be moved</div>
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}><ArrowRight size={20} style={{ color:'var(--text-muted)' }}/></div>
                <div style={{ padding:'14px 18px', borderRadius:'var(--radius-md)', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
                  <div className="text-xs text-muted mb-1">TO</div>
                  <div className="font-semibold text-success" style={{ fontSize:'1.1rem' }}>{toInfo?.name}</div>
                  <div className="text-sm text-muted">Session: {session}</div>
                </div>
              </div>
            )
            : (
              <p className="text-muted" style={{ textAlign:'center', padding:24 }}>
                Select the From and To classes to see a preview.
              </p>
            )
          }
        </div>
      </div>
    </div>
  );
}

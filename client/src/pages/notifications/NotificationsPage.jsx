import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { notificationService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { Bell, Send, CheckCheck, Clock, Users, Megaphone, Trash2 } from 'lucide-react';

// DEMO_NOTIFICATIONS list...


const DEMO_NOTIFICATIONS = [
  { id:'n1', title:'PTA Meeting Notice', message:'The PTA meeting is scheduled for 25th May 2026. All parents must attend.', recipient:'ALL', createdAt:'2026-05-18T10:00:00Z', read:false },
  { id:'n2', title:'Exam Timetable Released', message:'Second term examination timetable has been released. Check the notice board.', recipient:'STUDENTS', createdAt:'2026-05-15T08:30:00Z', read:false },
  { id:'n3', title:'Staff Meeting', message:'All teaching staff are required at the conference hall by 2pm on Friday.', recipient:'TEACHERS', createdAt:'2026-05-14T14:00:00Z', read:true },
  { id:'n4', title:'Fee Payment Reminder', message:'Parents are reminded that school fees for the second term are due.', recipient:'PARENTS', createdAt:'2026-05-10T09:00:00Z', read:true },
];

const RECIPIENT_BADGE = { ALL:'badge-primary', STUDENTS:'badge-info', TEACHERS:'badge-success', PARENTS:'badge-warning', STAFF:'badge-muted' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = ['SUPER_ADMIN','PRINCIPAL','VICE_PRINCIPAL'].includes(user?.role);

  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ title:'', message:'', recipient:'ALL' });

  const { data: notifications = DEMO_NOTIFICATIONS } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getAll().then(r => r.data.notifications || r.data || []).catch(() => DEMO_NOTIFICATIONS),
    placeholderData: DEMO_NOTIFICATIONS,
  });

  const { mutate: send, isPending } = useMutation({
    mutationFn: (data) => notificationService.create(data),
    onSuccess: () => {
      toast.success('Notification sent successfully!');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setCompose(false);
      setForm({ title:'', message:'', recipient:'ALL' });
    },
    onError: () => toast.error('Failed to send notification'),
  });

  const { mutate: markRead } = useMutation({
    mutationFn: (id) => notificationService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const { mutate: deleteNotification } = useMutation({
    mutationFn: (id) => notificationService.delete(id),
    onSuccess: () => {
      toast.success('Notification deleted');
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: () => toast.error('Failed to delete notification'),
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return toast.warning('Fill in title and message');
    send(form);
  };

  const unread = notifications.filter(n => !n.read).length;

  // Notifications are now tracked globally in DashboardLayout

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Notifications</h1>
          <p className="page-header-subtitle">School announcements and alerts{unread > 0 ? ` · ${unread} unread` : ''}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setCompose(c => !c)}>
            <Megaphone size={16}/> {compose ? 'Cancel' : 'New Notification'}
          </button>
        )}
      </div>

      {/* Compose Panel */}
      {compose && (
        <div className="card mb-6 animate-slide-up">
          <h3 style={{ marginBottom:16 }}>Send New Notification</h3>
          <form onSubmit={handleSend} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Title <span className="required">*</span></label>
                <input className="form-input" placeholder="Notification title" value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))}/>
              </div>
              <div className="form-group">
                <label className="form-label">Recipients</label>
                <select className="form-select" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient:e.target.value }))}>
                  {[['ALL','Everyone'],['STUDENTS','Students Only'],['TEACHERS','Teachers Only'],['PARENTS','Parents Only'],['STAFF','All Staff']].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message <span className="required">*</span></label>
              <textarea className="form-textarea" placeholder="Write your announcement…" value={form.message} onChange={e => setForm(f => ({ ...f, message:e.target.value }))}/>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCompose(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending
                  ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
                  : <><Send size={15}/> Send</>
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <Bell size={44} style={{ color:'var(--text-muted)', margin:'0 auto 14px', display:'block' }}/>
          <p className="text-muted">No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {notifications.map(n => (
            <div
              key={n.id}
              className="card card-hover animate-fade-in"
              style={{
                borderLeft: n.read ? '3px solid var(--border)' : '3px solid var(--primary)',
                opacity: n.read ? 0.75 : 1,
                display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between'
              }}
            >
              <div style={{ flex:1, cursor: n.read ? 'default' : 'pointer' }} onClick={() => !n.read && markRead(n.id)}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                  {!n.read && (
                    <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--primary)', flexShrink:0, display:'inline-block' }}/>
                  )}
                  <strong style={{ fontSize:'0.95rem' }}>{n.title}</strong>
                  <span className={`badge ${RECIPIENT_BADGE[n.recipient || n.targetRole] || 'badge-muted'}`}>
                    <Users size={10}/> {n.recipient || n.targetRole || 'ALL'}
                  </span>
                </div>
                <p style={{ fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:8 }}>{n.message}</p>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Clock size={12} style={{ color:'var(--text-muted)' }}/>
                  <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
                  {n.read && (
                    <>
                      <span className="text-muted" style={{ marginLeft:8 }}>·</span>
                      <CheckCheck size={12} style={{ color:'var(--text-muted)', marginLeft:4 }}/>
                      <span className="text-xs text-muted">Read</span>
                    </>
                  )}
                </div>
              </div>
              
              {isAdmin && (
                <button 
                  onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this notification?')) deleteNotification(n.id); }}
                  className="btn btn-secondary btn-sm btn-icon"
                  style={{ color: 'var(--danger)', flexShrink: 0 }}
                  title="Delete Notification"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

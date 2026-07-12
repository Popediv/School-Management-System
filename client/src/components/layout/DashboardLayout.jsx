import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services';
import { Bell, Menu, X, AlertCircle } from 'lucide-react';

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.06;
    o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(() => { o.stop(); ctx.close?.(); }, 180);
  } catch (e) {
    // ignore
  }
}

/* Map pathname → readable title */
const TITLES = {
  '/dashboard/admin':     'Admin Dashboard',
  '/dashboard/principal': 'Principal Dashboard',
  '/dashboard/teacher':   'Teacher Dashboard',
  '/dashboard/bursary':   'Bursary Dashboard',
  '/dashboard/parent':    'Parent Portal',
  '/dashboard/student':   'Student Portal',
  '/students':            'Students',
  '/students/register':   'Register Student',
  '/teachers':            'Teachers',
  '/teachers/register':   'Register Teacher',
  '/classes':             'Classes',
  '/classes/promotion':   'Class Promotion',
  '/attendance/mark':     'Mark Attendance',
  '/attendance/report':   'Attendance Reports',
  '/results/upload':      'Upload Results',
  '/fees':                'Fees & Bursary',
  '/idcards':             'ID Card Generator',
  '/notifications':       'Notifications',
};

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUrgentNotif, setShowUrgentNotif] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();

  const isAdmin = ['SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(user?.role);

  // Fetch notifications to show priority popups and poll every 15 seconds
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getAll().then(r => r.data.notifications || r.data || []),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user) return;
    const prevRaw = sessionStorage.getItem('sms_last_unread_count');
    const prev = prevRaw ? Number(prevRaw) : 0;

    // If the unread count INCREASES, it means a new notification just arrived!
    if (unreadCount > prev) {
      if (!isAdmin) {
        setShowUrgentNotif(true);
        playBeep();
      }
      
      // Also trigger a browser notification if permitted (for all)
      if ('Notification' in window && Notification.permission === 'granted') {
        const newest = notifications.filter(n => !n.read).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (newest) new Notification(newest.title, { body: newest.message });
      }
    }

    if (unreadCount !== prev) {
      sessionStorage.setItem('sms_last_unread_count', String(unreadCount));
    }
  }, [unreadCount, user, notifications]);

  const closeUrgentNotif = () => {
    setShowUrgentNotif(false);
  };

  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] || 'Dashboard';
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '?';

  return (
    <div className="app-layout">
      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:90 }}
        />
      )}

      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="btn btn-secondary btn-icon"
              style={{ display:'none' }}
              id="mobile-menu-btn"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="topbar-title">{title}</span>
          </div>

          <div className="topbar-right">
            <Link to="/notifications" className="btn btn-secondary btn-icon" title="Notifications" style={{ position: 'relative' }}>
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, background: 'var(--danger)', width: 10, height: 10, borderRadius: '50%' }} />
              )}
            </Link>
            <div className="topbar-avatar" title={user?.name}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content animate-fade-in">
          {children}
        </main>
      </div>

      {/* Priority Notification Modal */}
      {showUrgentNotif && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-slide-up" style={{ width: '90%', maxWidth: 400, padding: 24, textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fee2e2', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={30} style={{ color: '#ef4444' }} />
            </div>
            <h2 style={{ marginBottom: 12 }}>You have {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}!</h2>
            <p className="text-muted" style={{ marginBottom: 24 }}>Please check your notifications to stay updated with important school announcements.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={closeUrgentNotif}>Later</button>
              <Link to="/notifications" className="btn btn-primary" style={{ flex: 1 }} onClick={closeUrgentNotif}>
                View Now
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Show mobile menu btn via JS class trick */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../routes/ProtectedRoute';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, BarChart2, CreditCard, IdCard,
  Bell, LogOut, ChevronRight, School, UserCog,
  BookMarked, TrendingUp, Key
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

/* ── Nav items per role ── */
const NAV = {
  [ROLES.SUPER_ADMIN]: [
    { section: 'Overview', items: [
      { label: 'Dashboard',   icon: LayoutDashboard, to: '/dashboard/admin' },
    ]},
    { section: 'People', items: [
      { label: 'Students',    icon: GraduationCap,  to: '/students' },
      { label: 'Teachers',    icon: UserCog,         to: '/teachers' },
    ]},
    { section: 'Academic', items: [
      { label: 'Classes',     icon: School,          to: '/classes' },
      { label: 'Promotion',   icon: TrendingUp,      to: '/classes/promotion' },
      { label: 'Attendance',  icon: ClipboardList,   to: '/attendance/mark' },
      { label: 'Results',     icon: BookMarked,      to: '/results/upload' },
      { label: 'Scheme of Work', icon: BookOpen,     to: '/schemes' },
      { label: 'Reports',     icon: BarChart2,       to: '/attendance/report' },
    ]},
    { section: 'Admin', items: [
      { label: 'Fees & Bursary', icon: CreditCard,  to: '/fees' },
      { label: 'ID Cards',       icon: IdCard,       to: '/idcards' },
      { label: 'Notifications',  icon: Bell,         to: '/notifications' },
    ]},
  ],

  [ROLES.PRINCIPAL]: [
    { section: 'Overview', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, to: '/dashboard/principal' },
    ]},
    { section: 'Academic', items: [
      { label: 'Students',   icon: GraduationCap,  to: '/students' },
      { label: 'Teachers',   icon: UserCog,         to: '/teachers' },
      { label: 'Classes',    icon: School,          to: '/classes' },
      { label: 'Results',    icon: BookMarked,      to: '/results/upload' },
      { label: 'Scheme of Work', icon: BookOpen,     to: '/schemes' },
      { label: 'Attendance', icon: ClipboardList,   to: '/attendance/report' },
    ]},
    { section: 'Admin', items: [
      { label: 'Notifications', icon: Bell,         to: '/notifications' },
    ]},
  ],

  [ROLES.VICE_PRINCIPAL]: [
    { section: 'Overview', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, to: '/dashboard/admin' },
    ]},
    { section: 'Academic', items: [
      { label: 'Students',   icon: GraduationCap,  to: '/students' },
      { label: 'Classes',    icon: School,          to: '/classes' },
      { label: 'Scheme of Work', icon: BookOpen,     to: '/schemes' },
      { label: 'Attendance', icon: ClipboardList,   to: '/attendance/report' },
    ]},
  ],

  [ROLES.TEACHER]: [
    { section: 'Overview', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, to: '/dashboard/teacher' },
    ]},
    { section: 'Class Work', items: [
      { label: 'Students',   icon: GraduationCap,  to: '/students' },
      { label: 'Attendance', icon: ClipboardList,   to: '/attendance/mark' },
      { label: 'Results',    icon: BookMarked,      to: '/results/upload' },
      { label: 'Scheme of Work', icon: BookOpen,     to: '/schemes' },
      { label: 'Reports',    icon: BarChart2,       to: '/attendance/report' },
    ]},
    { section: 'Other', items: [
      { label: 'Notifications', icon: Bell,         to: '/notifications' },
    ]},
  ],

  [ROLES.BURSARY]: [
    { section: 'Overview', items: [
      { label: 'Dashboard',  icon: LayoutDashboard, to: '/dashboard/bursary' },
    ]},
    { section: 'Finance', items: [
      { label: 'Fees',       icon: CreditCard,      to: '/fees' },
      { label: 'Students',   icon: GraduationCap,  to: '/students' },
    ]},
  ],

  [ROLES.PARENT]: [
    { section: 'Portal', items: [
      { label: 'Dashboard',     icon: LayoutDashboard, to: '/dashboard/parent' },
      { label: 'Scheme of Work', icon: BookOpen,       to: '/schemes' },
      { label: 'Notifications', icon: Bell,            to: '/notifications' },
    ]},
  ],

  [ROLES.STUDENT]: [
    { section: 'Portal', items: [
      { label: 'Dashboard',     icon: LayoutDashboard, to: '/dashboard/student' },
      { label: 'Scheme of Work', icon: BookOpen,       to: '/schemes' },
      { label: 'Notifications', icon: Bell,            to: '/notifications' },
    ]},
  ],
};

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV[user?.role] || [];

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE' }
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
    : '??';

  return (
    <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'contain' }} />
        ) : (
          <div className="sidebar-logo-icon">PCI</div>
        )}
        <div className="sidebar-logo-text">
          <strong>{settings?.schoolName || 'PATIMO COLLEGE'}</strong>
          <span>School Management</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                onClick={onClose}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-item" style={{ marginBottom: 4 }}>
          <div className="avatar-placeholder avatar-sm" style={{ fontSize:'0.7rem' }}>{initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="text-sm font-semibold truncate text-primary">{user?.name || 'User'}</div>
            <div className="text-xs text-muted truncate">{user?.role?.replace('_',' ')}</div>
          </div>
        </div>
        <Link to="/change-password" onClick={onClose} className="sidebar-item btn" style={{ width:'100%', justifyContent:'flex-start', color:'var(--text-muted)' }}>
          <Key size={16} />
          <span>Change Password</span>
        </Link>
        <button className="sidebar-item btn" style={{ width:'100%', justifyContent:'flex-start', color:'var(--danger)' }} onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

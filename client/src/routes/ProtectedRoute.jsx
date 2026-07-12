import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Role constants
export const ROLES = {
  SUPER_ADMIN:   'SUPER_ADMIN',
  PRINCIPAL:     'PRINCIPAL',
  VICE_PRINCIPAL:'VICE_PRINCIPAL',
  TEACHER:       'TEACHER',
  BURSARY:       'BURSARY',
  PARENT:        'PARENT',
  STUDENT:       'STUDENT',
};

// Where each role lands after login
export const ROLE_HOME = {
  SUPER_ADMIN:    '/dashboard/admin',
  PRINCIPAL:      '/dashboard/principal',
  VICE_PRINCIPAL: '/dashboard/admin',
  TEACHER:        '/dashboard/teacher',
  BURSARY:        '/dashboard/bursary',
  PARENT:         '/dashboard/parent',
  STUDENT:        '/dashboard/student',
};

/**
 * Wrap a route so only authenticated users with the right role can see it.
 * Usage: <ProtectedRoute roles={['SUPER_ADMIN','PRINCIPAL']}><Page /></ProtectedRoute>
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <span className="animate-spin" style={{ width:32, height:32, border:'3px solid var(--border)', borderTopColor:'var(--primary)', borderRadius:'50%', display:'inline-block' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return children;
}

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../routes/ProtectedRoute';
import { Eye, EyeOff, LogIn, School } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

export default function LoginPage() {
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const { data: settings } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    placeholderData: { logoUrl: null, schoolName: 'PATIMO COLLEGE' }
  });

  const onSubmit = async ({ email, password }) => {
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}!`);
      const dest = location.state?.from?.pathname || ROLE_HOME[user.role] || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom: 32 }}>
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" style={{
              width: 72, height: 72, margin: '0 auto 16px',
              borderRadius: '50%', objectFit: 'contain',
              border: '2px solid var(--primary-light)',
              boxShadow: '0 8px 32px rgba(79,70,229,0.2)'
            }} />
          ) : (
            <div style={{
              width: 64, height: 64, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', fontWeight: 800, color: 'white',
              fontFamily: 'var(--font-display)',
              boxShadow: '0 8px 32px rgba(79,70,229,0.4)'
            }}>PCI</div>
          )}
          <h1 style={{ fontSize: '1.5rem', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{settings?.schoolName || 'PATIMO COLLEGE'}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            School Management System — Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group mb-4">
            <label className="form-label">
              Email Address or Username <span className="required">*</span>
            </label>
            <input
              type="text"
              className={`form-input${errors.email ? ' error' : ''}`}
              placeholder="Username, Admission No. or Email"
              {...register('email', {
                required: 'Email or Username is required'
              })}
            />
            {errors.email && <span className="form-error">{errors.email.message}</span>}
          </div>

          <div className="form-group mb-6">
            <label className="form-label">
              Password <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                className={`form-input${errors.password ? ' error' : ''}`}
                placeholder="Enter your password"
                style={{ paddingRight: 44 }}
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{
                  position:'absolute', right: 12, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)'
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full btn-lg"
            disabled={loading}
          >
            {loading
              ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
              : <><LogIn size={18} /> Sign In</>
            }
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:24, fontSize:'0.775rem', color:'var(--text-muted)' }}>
          Forgot password? Contact your system administrator.
        </p>
      </div>
    </div>
  );
}

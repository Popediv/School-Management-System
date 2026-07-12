import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services';
import { toast } from 'react-toastify';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    try {
      await authService.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '2rem auto', padding: '1.5rem' }}>
      <h2 className="mb-3">Change Password</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Current Password <span className="required">*</span></label>
          <input
            type="password"
            name="currentPassword"
            className="form-input"
            value={form.currentPassword}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">New Password <span className="required">*</span></label>
          <input
            type="password"
            name="newPassword"
            className="form-input"
            value={form.newPassword}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password <span className="required">*</span></label>
          <input
            type="password"
            name="confirmPassword"
            className="form-input"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Update Password</button>
      </form>
    </div>
  );
}

// Admin reset password page

export function AdminResetPasswordPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await authService.adminResetPassword(id, newPassword);
      toast.success('Password reset successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="card" style={{ maxWidth: 400, margin: '2rem auto', padding: '1.5rem' }}>
      <h2 className="mb-3">Admin Reset User Password</h2>
      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">New Password <span className="required">*</span></label>
          <input
            type="password"
            className="form-input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Reset Password</button>
      </form>
    </div>
  );
}

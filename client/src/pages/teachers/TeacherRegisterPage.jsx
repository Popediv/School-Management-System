import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { teacherService } from '../../services';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

const QUALIFICATIONS = ['B.Ed','B.Sc','B.A','M.Ed','M.Sc','M.A','PGDE','NCE','Ph.D','Other'];
const SUBJECTS = ['Mathematics','English Language','Physics','Chemistry','Biology','Geography','History','Economics','Government','Civic Education','CRS','Islamic Studies','Agricultural Science','Computer Science','French','Yoruba Language','Igbo Language','Hausa Language','Further Mathematics','Technical Drawing','Fine Art','Music','Physical Education'];

export default function TeacherRegisterPage() {
  const navigate = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await teacherService.create(data);
      toast.success(`Teacher ${res.data.teacher?.user?.name || data.name} registered successfully!`);
      navigate('/teachers');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', required = false, options, placeholder }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
      {options
        ? (
          <select className={`form-select${errors[name] ? ' error' : ''}`}
            {...register(name, required ? { required: `${label} is required` } : {})}>
            <option value="">Select {label}</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )
        : (
          <input type={type} placeholder={placeholder || label}
            className={`form-input${errors[name] ? ' error' : ''}`}
            {...register(name, required ? { required: `${label} is required` } : {})}/>
        )
      }
      {errors[name] && <span className="form-error">{errors[name].message}</span>}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Register Teacher</h1>
          <p className="page-header-subtitle">Add a new staff member — login credentials will be generated</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid-2">
          {/* Personal Info */}
          <div className="card">
            <h3 style={{ marginBottom:20 }}>Personal Information</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Field label="Full Name" name="name" required placeholder="e.g. Mr. Emmanuel Okafor"/>
              <div className="grid-2">
                <Field label="Gender" name="gender" required options={['Male','Female']}/>
                <Field label="Phone Number" name="phone" placeholder="+234…"/>
              </div>
              <Field label="Qualification" name="qualification" options={QUALIFICATIONS}/>
              <Field label="Date of Birth" name="dateOfBirth" type="date"/>
              <Field label="State of Origin" name="stateOfOrigin"/>
            </div>
          </div>

          {/* Account + Subject */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div className="card">
              <h3 style={{ marginBottom:20 }}>Login Account</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="form-group">
                  <label className="form-label">Email Address <span className="required">*</span></label>
                  <input type="email" className={`form-input${errors.email ? ' error' : ''}`}
                    placeholder="teacher@school.edu"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value:/\S+@\S+\.\S+/, message:'Enter a valid email' }
                    })}/>
                  {errors.email && <span className="form-error">{errors.email.message}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password <span className="required">*</span></label>
                  <div style={{ position:'relative' }}>
                    <input type={showPwd ? 'text' : 'password'}
                      className={`form-input${errors.password ? ' error' : ''}`}
                      placeholder="Minimum 8 characters"
                      style={{ paddingRight:44 }}
                      {...register('password', { required:'Password is required', minLength:{ value:8, message:'Minimum 8 characters' } })}/>
                    <button type="button" onClick={() => setShowPwd(s => !s)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}>
                      {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  {errors.password && <span className="form-error">{errors.password.message}</span>}
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom:20 }}>Subject Specialisation</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Field label="Primary Subject" name="primarySubject" options={SUBJECTS}/>
                <Field label="Secondary Subject" name="secondarySubject" options={SUBJECTS}/>
                <div className="alert alert-info">
                  <span style={{ fontSize:'0.8rem' }}>Class assignments can be done separately from the Classes management page after registration.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop:24 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/teachers')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading
              ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
              : <><UserPlus size={18}/> Register Teacher</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

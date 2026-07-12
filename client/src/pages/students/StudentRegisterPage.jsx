import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Webcam from 'react-webcam';
import { useQuery } from '@tanstack/react-query';
import { studentService, classService } from '../../services';
import { Upload, UserPlus, Camera, X } from 'lucide-react';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';

export default function StudentRegisterPage() {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const webcamRef = useRef(null);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || [])
  });

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoFile(file);
      setShowCamera(false);
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPhotoPreview(imageSrc);
      setShowCamera(false);
      // Convert base64 to file
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "webcam_photo.jpg", { type: "image/jpeg" });
          setPhotoFile(file);
        });
    }
  }, [webcamRef]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(data).forEach(([k,v]) => { if (v) fd.append(k, v); });
      if (photoFile) fd.append('photo', photoFile);

      const res = await studentService.create(fd);
      toast.success(`Student registered! Admission No: ${res.data.admissionNo}`);
      navigate(`/students/${res.data.id}/admission-letter`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, name, type='text', required=false, options, placeholder }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
      {options
        ? <select className={`form-select${errors[name] ? ' error':''}`} {...register(name, required ? { required:`${label} is required` } : {})}>
            <option value="">Select {label}</option>
            {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
          </select>
        : <input type={type} placeholder={placeholder || label} className={`form-input${errors[name] ? ' error':''}`}
            {...register(name, required ? { required:`${label} is required` } : {})} />
      }
      {errors[name] && <span className="form-error">{errors[name].message}</span>}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Register New Student</h1>
          <p className="page-header-subtitle">Admission number will be auto-generated upon submission</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid-2">
          {/* ── Left column ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {/* Photo Upload */}
            <div className="card">
              <h3 className="mb-4">Passport Photograph</h3>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                
                {showCamera ? (
                  <div style={{ position:'relative', width:200, height:200, borderRadius:'var(--radius-md)', overflow:'hidden', background:'black' }}>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowCamera(false)}
                      style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', color:'white', border:'none', borderRadius:'50%', padding:4, cursor:'pointer' }}
                    >
                      <X size={16}/>
                    </button>
                    <button 
                      type="button"
                      onClick={capture}
                      className="btn btn-primary btn-sm"
                      style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}
                    >
                      <Camera size={14}/> Capture
                    </button>
                  </div>
                ) : (
                  <div style={{
                    width:120, height:140, borderRadius:'var(--radius-md)',
                    background:'var(--bg-elevated)', border:'2px dashed var(--border)',
                    display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden',
                    position:'relative'
                  }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <Upload size={32} style={{ color:'var(--text-muted)' }} />
                    }
                    {photoPreview && (
                      <button 
                        type="button"
                        onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                        style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.5)', color:'white', border:'none', borderRadius:'50%', padding:4, cursor:'pointer' }}
                      >
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                )}

                {!showCamera && (
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                    <label className="btn btn-secondary btn-sm" style={{ cursor:'pointer' }}>
                      <Upload size={14}/> Upload
                      <input id="student-photo" type="file" accept="image/*" style={{ display:'none' }} onChange={handlePhoto} />
                    </label>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCamera(true)}>
                      <Camera size={14}/> Take Photo
                    </button>
                  </div>
                )}
                
                <p className="text-xs text-muted">JPG, PNG. Max 2MB. Passport style.</p>
              </div>
            </div>

            {/* Parent Info */}
            <div className="card">
              <h3 className="mb-4">Parent / Guardian</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Field label="Parent Full Name"  name="parentName"  required />
                <Field label="Parent Phone"      name="parentPhone" required placeholder="+234…" />
                <Field label="Parent Email"      name="parentEmail" type="email" />
                <Field label="Home Address"      name="homeAddress" />
                <Field label="Relationship"      name="relationship"
                  options={['Father','Mother','Guardian','Uncle','Aunt','Other']} />
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {/* Bio Data */}
            <div className="card">
              <h3 className="mb-4">Student Bio Data</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div className="grid-2">
                  <Field label="First Name"  name="firstName"  required />
                  <Field label="Last Name"   name="lastName"   required />
                </div>
                <Field label="Other Names"  name="otherNames" />
                <div className="grid-2">
                  <Field label="Date of Birth" name="dateOfBirth" type="date" required />
                  <Field label="Gender" name="gender" required
                    options={[{value:'Male',label:'Male'},{value:'Female',label:'Female'}]} />
                </div>
                <Field label="State of Origin" name="stateOfOrigin" />
                <Field label="LGA" name="lga" placeholder="Local Government Area" />
                <Field label="Religion" name="religion"
                  options={['Christianity','Islam','Others']} />
                <Field label="Blood Group" name="bloodGroup"
                  options={['A+','A-','B+','B-','AB+','AB-','O+','O-']} />
              </div>
            </div>

            {/* Admission Info */}
            <div className="card">
              <h3 className="mb-4">Admission Details</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Field label="Admission Class" name="classId" required
                  options={classes.map(c => ({ value: c.id, label: c.name }))} />
                <Field label="Academic Session" name="session" required
                  options={SESSIONS} />
                <Field label="Previous School" name="previousSchool" />
                <Field label="Entry Status" name="status"
                  options={[{value:'ACTIVE',label:'Active'},{value:'SUSPENDED',label:'Suspended'}]} />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop:24 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/students')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading
              ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
              : <><UserPlus size={18}/> Register Student</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

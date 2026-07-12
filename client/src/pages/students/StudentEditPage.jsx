import { useState, useRef, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Webcam from 'react-webcam';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../../services';
import api from '../../services/api';
import { Upload, Save, Camera, X, ArrowLeft } from 'lucide-react';

export default function StudentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const webcamRef = useRef(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  // Fetch current student profile
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentService.getById(id).then(r => r.data),
    onSuccess: (data) => {
      // Prepopulate form when data loads
      reset({
        firstName: data.firstName,
        lastName: data.lastName,
        otherNames: data.otherNames,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
        gender: data.gender,
        stateOfOrigin: data.stateOfOrigin || '',
        lga: data.lga || '',
        religion: data.religion || '',
        bloodGroup: data.bloodGroup || '',
        previousSchool: data.previousSchool || '',
        status: data.status || 'ACTIVE'
      });
      if (data.photo) {
        setPhotoPreview(`/uploads/${data.photo}`);
      }
    }
  });

  // Since react-query v4/v5 might handle onSuccess differently, let's also trigger reset inside a useEffect
  useEffect(() => {
    if (student) {
      reset({
        firstName: student.firstName,
        lastName: student.lastName,
        otherNames: student.otherNames || '',
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
        gender: student.gender,
        stateOfOrigin: student.stateOfOrigin || '',
        lga: student.lga || '',
        religion: student.religion || '',
        bloodGroup: student.bloodGroup || '',
        previousSchool: student.previousSchool || '',
        status: student.status || 'ACTIVE'
      });
      if (student.photo) {
        setPhotoPreview(`/uploads/${student.photo}`);
      }
    }
  }, [student, reset]);

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
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          fd.append(k, v);
        }
      });
      if (photoFile) {
        fd.append('photo', photoFile);
      }

      await studentService.update(id, fd);
      toast.success('Student profile updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      navigate(`/students/${id}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update student profile');
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

  if (isLoading) {
    return <div className="p-8 text-center text-muted">Loading profile editor...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/students/${id}`)} className="btn btn-secondary btn-sm" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-header-title">Edit Student Profile</h1>
            <p className="page-header-subtitle">Update record details for {student?.firstName} {student?.lastName}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid-2">
          {/* Left Column */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            {/* Passport Photo */}
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
                    {photoFile && (
                      <button 
                        type="button"
                        onClick={() => { setPhotoPreview(student?.photo ? `/uploads/${student.photo}` : null); setPhotoFile(null); }}
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
                      <Upload size={14}/> Change Photo
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

            {/* Static Parent/Class info read-only warning */}
            <div className="card" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-2">Academic & Guardian Reference</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Current Class, Academic Session, parent association, and login credentials can only be edited by authorized Administrators through promotions, class enrollments, and user managers to preserve audit integrity.
              </p>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Class Assigned:</span>
                  <span style={{ fontWeight: 600 }}>{student?.currentClass?.name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Portal Email:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{student?.user?.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Parent Guardian:</span>
                  <span style={{ fontWeight: 600 }}>{student?.parent?.name || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
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
                <Field label="Previous School" name="previousSchool" />
                <Field label="Student Status" name="status" required
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'SUSPENDED', label: 'Suspended' },
                    { value: 'GRADUATED', label: 'Graduated' },
                    { value: 'WITHDRAWN', label: 'Withdrawn' }
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop:24 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/students/${id}`)}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading
              ? <span className="animate-spin" style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }}/>
              : <><Save size={18}/> Save Updates</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}

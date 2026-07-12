import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { UserPlus, Search, Filter, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import { studentService } from '../../services';
import api from '../../services/api';

const STATUS_COLORS = { ACTIVE:'success', SUSPENDED:'warning', GRADUATED:'info', WITHDRAWN:'danger' };

export default function StudentListPage() {
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [classFilter, setClass] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', search, status, classFilter],
    queryFn: () => studentService.getAll({ search, status, class: classFilter }).then(r => r.data),
    placeholderData: { students: [
      { id:'s1', firstName:'Adaeze', lastName:'Okonkwo', admissionNo:'GFM-2026-0001', currentClass:{ name:'JSS1A' }, status:'ACTIVE' },
      { id:'s2', firstName:'Emeka',  lastName:'Nwosu',   admissionNo:'GFM-2026-0002', currentClass:{ name:'SS2B'  }, status:'ACTIVE' },
      { id:'s3', firstName:'Chisom', lastName:'Eze',     admissionNo:'GFM-2026-0003', currentClass:{ name:'JSS3A' }, status:'SUSPENDED' },
    ], total: 3 }
  });

  const students = data?.students || [];

  const handleExportMoodle = async () => {
    try {
      const res = await api.get('/students/moodle-export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'moodle_users_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to export Moodle users');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Students</h1>
          <p className="page-header-subtitle">{data?.total ?? 0} students enrolled</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleExportMoodle} className="btn btn-secondary">
            <Download size={16}/> Export Moodle CSV
          </button>
          <Link to="/students/register" className="btn btn-primary">
            <UserPlus size={16}/> Register Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding:'16px 20px' }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <div className="search-bar" style={{ flex:1, minWidth:200 }}>
            <Search size={16}/>
            <input className="form-input" placeholder="Search by name or admission no…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width:160 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="GRADUATED">Graduated</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
          <select className="form-select" style={{ width:140 }} value={classFilter} onChange={e => setClass(e.target.value)}>
            <option value="">All Classes</option>
            {['JSS1A','JSS1B','JSS2A','JSS2B','JSS3A','JSS3B','SS1A','SS1B','SS2A','SS2B','SS3A','SS3B'].map(c =>
              <option key={c} value={c}>{c}</option>
            )}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Name</th><th>Admission No.</th>
              <th>Class</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_,i) => (
                    <tr key={i}>{Array.from({length:6}).map((_,j) =>
                      <td key={j}><div className="skeleton" style={{height:16,width:'80%'}}/></td>)}</tr>
                  ))
                : students.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td><strong>{s.lastName} {s.firstName}</strong></td>
                    <td><code style={{ fontSize:'0.8rem', color:'var(--primary-light)' }}>{s.admissionNo}</code></td>
                    <td>{s.currentClass?.name ?? '—'}</td>
                    <td><span className={`badge badge-${STATUS_COLORS[s.status] ?? 'muted'}`}>{s.status}</span></td>
                    <td>
                      <Link to={`/students/${s.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
                    </td>
                  </tr>
                ))
              }
              {!isLoading && students.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                  No students found. Try adjusting your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Search, Filter, Download, Trash2, Printer, CheckSquare, Square } from 'lucide-react';
import { toast } from 'react-toastify';
import { studentService, classService } from '../../services';
import api from '../../services/api';
import { SESSIONS, CURRENT_SESSION } from '../../utils/constants';

const STATUS_COLORS = { ACTIVE: 'success', SUSPENDED: 'warning', GRADUATED: 'info', WITHDRAWN: 'danger' };

export default function StudentListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [classFilter, setClass] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferClassId, setTransferClassId] = useState('');
  const [transferSession, setTransferSession] = useState(CURRENT_SESSION);

  const { data: classesList = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || [])
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students', search, status, classFilter],
    queryFn: () => studentService.getAll({ search, status, class: classFilter }).then(r => r.data),
    placeholderData: {
      students: [
        { id: 's1', firstName: 'Adaeze', lastName: 'Okonkwo', admissionNo: 'GFM-2026-0001', currentClass: { name: 'JSS1A' }, status: 'ACTIVE' },
        { id: 's2', firstName: 'Emeka', lastName: 'Nwosu', admissionNo: 'GFM-2026-0002', currentClass: { name: 'SS2B' }, status: 'ACTIVE' },
        { id: 's3', firstName: 'Chisom', lastName: 'Eze', admissionNo: 'GFM-2026-0003', currentClass: { name: 'JSS3A' }, status: 'SUSPENDED' },
      ], total: 3
    }
  });

  const students = data?.students || [];

  const { mutate: deleteStudent } = useMutation({
    mutationFn: (id) => studentService.delete(id),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Student record deleted permanently');
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete student')
  });

  const handleDelete = (s) => {
    if (window.confirm(`Are you sure you want to PERMANENTLY delete ${s.firstName} ${s.lastName}? This action cannot be undone.`)) {
      deleteStudent(s.id);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(students.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const { mutate: bulkDeleteStudents } = useMutation({
    mutationFn: (ids) => studentService.bulkDelete(ids),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Selected students deleted successfully');
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete selected students')
  });

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to PERMANENTLY delete the ${selectedIds.length} selected student(s)?\n\nNote: Active and Graduated student records are protected and will be automatically skipped for safety.`)) {
      bulkDeleteStudents(selectedIds);
    }
  };

  const handleBulkPrintLetters = () => {
    if (selectedIds.length === 0) {
      toast.info('Please select at least one student or select all to generate bulk admission letters.');
      return;
    }
    navigate(`/students/admission-letters/bulk?ids=${selectedIds.join(',')}`);
  };

  const { mutate: transferStudents, isPending: isTransferring } = useMutation({
    mutationFn: (data) => studentService.transferClass(data),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Students transferred successfully');
      setShowTransferModal(false);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to transfer students')
  });

  const submitTransfer = () => {
    if (!transferClassId || !transferSession) {
      toast.error('Please select both a target class and academic session');
      return;
    }
    transferStudents({ studentIds: selectedIds, newClassId: transferClassId, session: transferSession });
  };

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

  const handleExportCustomMoodle = async () => {
    try {
      const res = await api.get('/students/moodle-import', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'moodle_users_import.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to export Custom Moodle CSV');
    }
  };

  const handleExportPicturesZip = async () => {
    try {
      const res = await api.get('/students/pictures-zip', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'student_pictures.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toast.error('Failed to download student pictures ZIP');
    }
  };

  const allSelected = students.length > 0 && selectedIds.length === students.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Students</h1>
          <p className="page-header-subtitle">{data?.total ?? 0} students enrolled</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <>
              <button onClick={() => setShowTransferModal(true)} className="btn btn-primary" style={{ backgroundColor: '#4F46E5', borderColor: '#4F46E5' }}>
                Transfer Class ({selectedIds.length})
              </button>
              <button onClick={handleBulkPrintLetters} className="btn btn-primary" style={{ backgroundColor: '#0284C7', borderColor: '#0284C7' }}>
                <Printer size={16} /> Bulk Admission Letters ({selectedIds.length})
              </button>
              <button onClick={handleBulkDelete} className="btn btn-danger" style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}>
                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
              </button>
            </>
          )}
          <button onClick={handleExportMoodle} className="btn btn-secondary">
            <Download size={16} /> Default CSV
          </button>
          <button onClick={handleExportCustomMoodle} className="btn btn-secondary">
            <Download size={16} /> Moodle CSV
          </button>
          <button onClick={handleExportPicturesZip} className="btn btn-secondary">
            <Download size={16} /> Photos ZIP
          </button>
          <Link to="/students/register" className="btn btn-primary">
            <UserPlus size={16} /> Register Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <Search size={16} />
            <input className="form-input" placeholder="Search by name or admission no…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={status} onChange={e => { setStatus(e.target.value); setSelectedIds([]); }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="GRADUATED">Graduated (Alumni)</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
          <select className="form-select" style={{ width: 140 }} value={classFilter} onChange={e => { setClass(e.target.value); setSelectedIds([]); }}>
            <option value="">All Classes</option>
            {['JSS1A', 'JSS1B', 'JSS2A', 'JSS2B', 'JSS3A', 'JSS3B', 'SS1A', 'SS1B', 'SS2A', 'SS2B', 'SS3A', 'SS3B'].map(c =>
              <option key={c} value={c}>{c}</option>
            )}
          </select>
          {students.length > 0 && (
            <button
              onClick={() => {
                if (allSelected) setSelectedIds([]);
                else setSelectedIds(students.map(s => s.id));
              }}
              className="btn btn-secondary btn-sm"
              title="Select or deselect all visible students"
            >
              {allSelected ? 'Deselect All' : `Select All (${students.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
              </th>
              <th>#</th><th>Name</th><th>Admission No.</th>
              <th>Class</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) =>
                    <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>)}</tr>
                ))
                : students.map((s, i) => {
                  const isChecked = selectedIds.includes(s.id);
                  const isDeletable = s.status === 'WITHDRAWN' || s.status === 'SUSPENDED';
                  return (
                    <tr key={s.id} style={{ backgroundColor: isChecked ? 'rgba(79, 70, 229, 0.04)' : undefined }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectOne(s.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td className="text-muted">{i + 1}</td>
                      <td><strong>{s.lastName} {s.firstName}</strong></td>
                      <td><code style={{ fontSize: '0.8rem', color: 'var(--primary-light)' }}>{s.admissionNo}</code></td>
                      <td>{s.currentClass?.name ?? '—'}</td>
                      <td><span className={`badge badge-${STATUS_COLORS[s.status] ?? 'muted'}`}>{s.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Link to={`/students/${s.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
                          {isDeletable && (
                            <button
                              onClick={() => handleDelete(s)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px' }}
                              title="Permanently delete non-active student record"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              }
              {!isLoading && students.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No students found. Try adjusting your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTransferModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 8 }}>Transfer Class ({selectedIds.length} selected)</h2>
            <p className="text-muted text-sm mb-4">This will migrate the student to a new class and seamlessly move their past attendance records.</p>

            <div className="form-group">
              <label className="form-label">Target Class</label>
              <select className="form-select" value={transferClassId} onChange={e => setTransferClassId(e.target.value)}>
                <option value="">Select Target Class</option>
                {classesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group mt-3">
              <label className="form-label">Academic Session</label>
              <select className="form-select" value={transferSession} onChange={e => setTransferSession(e.target.value)}>
                {SESSIONS?.map(s => <option key={s.value ?? s} value={s.value ?? s}>{s.label ?? s}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowTransferModal(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={submitTransfer} disabled={isTransferring} className="btn btn-primary" style={{ backgroundColor: '#4F46E5' }}>
                {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


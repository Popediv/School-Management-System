import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { BarChart2, Search, Download } from 'lucide-react';
import { attendanceService, classService } from '../../services';

export default function AttendanceReportPage() {
  const [filters, setFilters] = useState({ classId: '', startDate: '', endDate: '' });
  const [maxGrade, setMaxGrade] = useState(5);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classService.getAll().then(r => r.data.classes || r.data || []),
    placeholderData: [
      { id: 'c1', name: 'JSS1A' }, { id: 'c2', name: 'SS1A' }, { id: 'c3', name: 'SS2A' },
    ],
  });

  const set = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const generate = async () => {
    setLoading(true);
    try {
      const res = await attendanceService.getReport(filters);
      const records = res.data.records || res.data.report || res.data || [];

      // Transform backend attendance rows into per-student aggregates expected by the table UI
      const byStudent = new Map();

      (records || []).forEach((r) => {
        const studentId = r.studentId;
        if (!studentId) return;

        if (!byStudent.has(studentId)) {
          byStudent.set(studentId, {
            studentId,
            studentName: `${r.student?.firstName || ''} ${r.student?.lastName || ''}`.trim() || '—',
            className: r.class?.name || '—',
            present: 0,
            absent: 0,
            late: 0,
            total: 0,
            rate: 0,
          });
        }

        const row = byStudent.get(studentId);
        if (r.status === 'PRESENT') row.present++;
        else if (r.status === 'ABSENT') row.absent++;
        else if (r.status === 'LATE') row.late++;
      });

      const aggregated = Array.from(byStudent.values()).map((row) => {
        row.total = row.present + row.absent + row.late;
        row.rate = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0;
        return row;
      });

      setReport(aggregated);
      if (aggregated.length === 0) toast.info('No attendance records found for the selected filters.');
    } catch {
      toast.error('Failed to load attendance report');
      /* Demo fallback */
      setReport([
        { studentId:'s1', studentName:'Adaeze Okonkwo', className:'JSS1A', present:18, absent:2, late:1, total:21, rate:90 },
        { studentId:'s2', studentName:'Emeka Nwosu',    className:'JSS1A', present:20, absent:0, late:1, total:21, rate:100 },
        { studentId:'s3', studentName:'Chisom Eze',     className:'JSS1A', present:14, absent:6, late:1, total:21, rate:71 },
        { studentId:'s4', studentName:'Tunde Bakare',   className:'JSS1A', present:10, absent:9, late:2, total:21, rate:57 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const rateBadge = (rate) => {
    if (rate >= 75) return 'badge-success';
    if (rate >= 50) return 'badge-warning';
    return 'badge-danger';
  };

  const downloadCSV = () => {
    if (!report || report.length === 0) return;
    const headers = ['Student Name', 'Class', 'Present', 'Absent', 'Late', 'Total Days', 'Rate (%)', `Score (Max ${maxGrade})`];
    const rows = report.map(r => [
      `"${r.studentName}"`,
      `"${r.className}"`,
      r.present,
      r.absent,
      r.late,
      r.total,
      r.rate,
      Math.round((r.rate / 100) * maxGrade * 10) / 10
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Report_${filters.classId || 'All'}_${filters.startDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Attendance Reports</h1>
          <p className="page-header-subtitle">View attendance summaries by class and date range</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card mb-4">
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ flex:1, minWidth:180 }}>
            <label className="form-label">Class</label>
            <select className="form-select" value={filters.classId} onChange={e => set('classId', e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ minWidth:160 }}>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" value={filters.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ minWidth:160 }}>
            <label className="form-label">End Date</label>
            <input type="date" className="form-input" value={filters.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ minWidth:100 }}>
            <label className="form-label">Max Score</label>
            <input type="number" min="1" max="100" className="form-input" value={maxGrade} onChange={e => setMaxGrade(Number(e.target.value))} />
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ paddingBottom:10 }}>
            {loading
              ? <span className="animate-spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', display:'inline-block' }} />
              : <><Search size={15}/> Generate Report</>
            }
          </button>
        </div>
      </div>

      {/* Results */}
      {report === null && (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <BarChart2 size={44} style={{ color:'var(--text-muted)', margin:'0 auto 14px', display:'block' }} />
          <p className="text-muted">Select filters above and click <strong>Generate Report</strong> to view attendance data.</p>
        </div>
      )}

      {report !== null && report.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:48 }}>
          <p className="text-muted">No records found for the selected filters.</p>
        </div>
      )}

      {report !== null && report.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="btn btn-secondary" onClick={downloadCSV}>
              <Download size={16} /> Download CSV
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid-stat mb-4">
            {[
              { label:'Students',     value: report.length,                           color:'indigo' },
              { label:'Avg. Rate',    value: `${Math.round(report.reduce((a,r)=>a+r.rate,0)/report.length)}%`, color:'green' },
              { label:'Perfect Att.', value: report.filter(r=>r.rate===100).length,   color:'cyan' },
              { label:'At Risk (<75%)',value: report.filter(r=>r.rate<75).length,     color:'red' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrapper">
              <table>
                <thead><tr>
                  <th>Student</th><th>Class</th><th>Present</th><th>Absent</th><th>Late</th><th>Total Days</th><th>Rate</th><th>Score (/{maxGrade})</th>
                </tr></thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.studentId}>
                      <td><strong>{r.studentName}</strong></td>
                      <td>{r.className}</td>
                      <td style={{ color:'var(--success)', fontWeight:600 }}>{r.present}</td>
                      <td style={{ color:'var(--danger)',  fontWeight:600 }}>{r.absent}</td>
                      <td style={{ color:'var(--accent)',  fontWeight:600 }}>{r.late}</td>
                      <td>{r.total}</td>
                      <td>
                        <span className={`badge ${rateBadge(r.rate)}`}>{r.rate}%</span>
                      </td>
                      <td>
                        <strong>{Math.round((r.rate / 100) * maxGrade * 10) / 10}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

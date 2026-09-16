import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft } from 'lucide-react';
import { studentService } from '../../services';
import api from '../../services/api';
import { AdmissionLetterContent } from './AdmissionLetterPage';

export default function BulkAdmissionLettersPage() {
    const [searchParams] = useSearchParams();
    const idsParam = searchParams.get('ids') || '';
    const studentIds = idsParam.split(',').filter(Boolean);

    const { data: students = [], isLoading } = useQuery({
        queryKey: ['bulk-students', idsParam],
        queryFn: async () => {
            if (studentIds.length === 0) return [];
            const requests = studentIds.map(id =>
                studentService.getById(id).then(r => r.data).catch(() => null)
            );
            const results = await Promise.all(requests);
            return results.filter(Boolean);
        },
        enabled: studentIds.length > 0
    });

    const { data: settings } = useQuery({
        queryKey: ['school-settings'],
        queryFn: () => api.get('/settings').then(r => r.data),
        placeholderData: { logoUrl: null, schoolName: 'PATIMO SCHOOLS INTERNATIONAL' }
    });

    const handlePrint = () => window.print();

    if (isLoading) return <div className="p-8 text-center text-muted">Loading admission letters...</div>;
    if (students.length === 0) return (
        <div className="p-8 text-center text-muted">
            No students selected. Please go back and select students to generate bulk admission letters.
            <div className="mt-4">
                <Link to="/students" className="btn btn-secondary"><ArrowLeft size={16} /> Back to Students</Link>
            </div>
        </div>
    );

    return (
        <div>
            {/* Hide controls when printing */}
            <div className="print-hidden flex items-center justify-between mb-6">
                <Link to="/students" className="btn btn-secondary">
                    <ArrowLeft size={16} /> Back to Students
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="text-sm text-muted">Ready to print <strong>{students.length}</strong> admission letters</span>
                    <button className="btn btn-primary" onClick={handlePrint}>
                        <Printer size={16} /> Print / Save as PDF ({students.length})
                    </button>
                </div>
            </div>

            <div className="bulk-letters-container flex flex-col gap-8">
                {students.map(student => (
                    <AdmissionLetterContent
                        key={student.id}
                        student={student}
                        settings={settings}
                        isBulk={true}
                    />
                ))}
            </div>

            <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body, html { background: white; margin: 0; padding: 0; color: #000000 !important; }
          .topbar, .sidebar, .print-hidden { display: none !important; }
          .bulk-letters-container { gap: 0 !important; }
          .print-document { 
            box-shadow: none !important; 
            margin: 0 auto !important; 
            padding: 18px 30px !important; 
            width: 210mm !important;
            max-height: 285mm !important;
            box-sizing: border-box !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            color: #000000 !important;
          }
          .print-document:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-document * {
            color: #000000 !important;
          }
          #root, .app-container, .main-content { margin: 0; padding: 0; }
        }
      `}</style>
        </div>
    );
}

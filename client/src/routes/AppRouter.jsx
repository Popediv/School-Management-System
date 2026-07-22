import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute, { ROLES, ROLE_HOME } from './ProtectedRoute';

// Layouts
import DashboardLayout from '../components/layout/DashboardLayout';

// Auth
import LoginPage from '../pages/auth/LoginPage';
import ChangePasswordPage, { AdminResetPasswordPage } from '../pages/auth/ChangePasswordPage';

// Dashboards
import AdminDashboard      from '../pages/dashboard/AdminDashboard';
import PrincipalDashboard  from '../pages/dashboard/PrincipalDashboard';
import TeacherDashboard    from '../pages/dashboard/TeacherDashboard';
import BursaryDashboard    from '../pages/dashboard/BursaryDashboard';
import ParentDashboard     from '../pages/dashboard/ParentDashboard';
import StudentDashboard    from '../pages/dashboard/StudentDashboard';

// Students
import StudentListPage     from '../pages/students/StudentListPage';
import StudentRegisterPage from '../pages/students/StudentRegisterPage';
import StudentProfilePage  from '../pages/students/StudentProfilePage';
import StudentEditPage     from '../pages/students/StudentEditPage';
import AdmissionLetterPage from '../pages/students/AdmissionLetterPage';

// Teachers
import TeacherListPage     from '../pages/teachers/TeacherListPage';
import TeacherRegisterPage from '../pages/teachers/TeacherRegisterPage';

// Classes
import ClassListPage       from '../pages/classes/ClassListPage';
import PromotionPage       from '../pages/classes/PromotionPage';

// Attendance
import MarkAttendancePage  from '../pages/attendance/MarkAttendancePage';
import AttendanceReportPage from '../pages/attendance/AttendanceReportPage';

// Results
import UploadResultsPage   from '../pages/results/UploadResultsPage';
import ReportCardPage      from '../pages/results/ReportCardPage';

// Fees
import FeesPage            from '../pages/fees/FeesPage';
import PaymentPage         from '../pages/fees/PaymentPage';
import ReceiptViewPage     from '../pages/fees/ReceiptViewPage';

// ID Cards
import IDCardPage          from '../pages/idcards/IDCardPage';

// Notifications
import NotificationsPage   from '../pages/notifications/NotificationsPage';

// Schemes of Work
import SchemesPage         from '../pages/schemes/SchemesPage';
import ManageSchemePage    from '../pages/schemes/ManageSchemePage';
import ManagePdfsPage      from '../pages/schemes/ManagePdfsPage';

// Subjects
import SubjectListPage     from '../pages/subjects/SubjectListPage';

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];

export default function AppRouter() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/"      element={<Navigate to="/login" replace />} />
            <Route path="/change-password" element={
              <ProtectedRoute roles={Object.values(ROLES)}>
                <DashboardLayout><ChangePasswordPage /></DashboardLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin-reset/:id" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
                <DashboardLayout><AdminResetPasswordPage /></DashboardLayout>
              </ProtectedRoute>
            } />

            {/* ── Admin / Principal / VP ── */}
            <Route path="/dashboard/admin" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.VICE_PRINCIPAL]}>
                <DashboardLayout><AdminDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/dashboard/principal" element={
              <ProtectedRoute roles={[ROLES.PRINCIPAL]}>
                <DashboardLayout><PrincipalDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Students */}
            <Route path="/students" element={
              <ProtectedRoute roles={[...ADMIN_ROLES, ROLES.TEACHER, ROLES.BURSARY]}>
                <DashboardLayout><StudentListPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/students/register" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
                <DashboardLayout><StudentRegisterPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/students/:id/admission-letter" element={
              <ProtectedRoute roles={[...ADMIN_ROLES]}>
                <DashboardLayout><AdmissionLetterPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/students/:id" element={
              <ProtectedRoute roles={[...ADMIN_ROLES, ROLES.TEACHER, ROLES.BURSARY]}>
                <DashboardLayout><StudentProfilePage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/students/:id/edit" element={
              <ProtectedRoute roles={[...ADMIN_ROLES, ROLES.TEACHER]}>
                <DashboardLayout><StudentEditPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Teachers */}
            <Route path="/teachers" element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <DashboardLayout><TeacherListPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/teachers/register" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
                <DashboardLayout><TeacherRegisterPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Classes */}
            <Route path="/classes" element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <DashboardLayout><ClassListPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/classes/promotion" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.PRINCIPAL]}>
                <DashboardLayout><PromotionPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Subjects */}
            <Route path="/subjects" element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <DashboardLayout><SubjectListPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Attendance */}
            <Route path="/attendance/mark" element={
              <ProtectedRoute roles={[ROLES.TEACHER, ...ADMIN_ROLES]}>
                <DashboardLayout><MarkAttendancePage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/attendance/report" element={
              <ProtectedRoute roles={[...ADMIN_ROLES, ROLES.TEACHER]}>
                <DashboardLayout><AttendanceReportPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Results */}
            <Route path="/results/upload" element={
              <ProtectedRoute roles={[ROLES.TEACHER, ...ADMIN_ROLES]}>
                <DashboardLayout><UploadResultsPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/results/report-card/:studentId" element={
              <ProtectedRoute roles={[...ADMIN_ROLES, ROLES.TEACHER, ROLES.PARENT, ROLES.STUDENT]}>
                <DashboardLayout><ReportCardPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Fees */}
            <Route path="/fees" element={
              <ProtectedRoute roles={[ROLES.BURSARY, ROLES.SUPER_ADMIN]}>
                <DashboardLayout><FeesPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/fees/pay/:paymentId" element={
              <ProtectedRoute roles={[ROLES.BURSARY, ROLES.SUPER_ADMIN]}>
                <DashboardLayout><PaymentPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/fees/receipt/:paymentId" element={
              <ProtectedRoute roles={Object.values(ROLES)}>
                <DashboardLayout><ReceiptViewPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* ID Cards */}
            <Route path="/idcards" element={
              <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.PRINCIPAL]}>
                <DashboardLayout><IDCardPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Notifications */}
            <Route path="/notifications" element={
              <ProtectedRoute roles={Object.values(ROLES)}>
                <DashboardLayout><NotificationsPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Schemes of Work */}
            <Route path="/schemes" element={
              <ProtectedRoute roles={Object.values(ROLES)}>
                <DashboardLayout><SchemesPage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/schemes/manage" element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <DashboardLayout><ManageSchemePage /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/schemes/manage-pdfs" element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <DashboardLayout><ManagePdfsPage /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Role dashboards */}
            <Route path="/dashboard/teacher" element={
              <ProtectedRoute roles={[ROLES.TEACHER]}>
                <DashboardLayout><TeacherDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/dashboard/bursary" element={
              <ProtectedRoute roles={[ROLES.BURSARY]}>
                <DashboardLayout><BursaryDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/dashboard/parent" element={
              <ProtectedRoute roles={[ROLES.PARENT]}>
                <DashboardLayout><ParentDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>
            <Route path="/dashboard/student" element={
              <ProtectedRoute roles={[ROLES.STUDENT]}>
                <DashboardLayout><StudentDashboard /></DashboardLayout>
              </ProtectedRoute>
            }/>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          <ToastContainer
            position="top-right"
            autoClose={4000}
            theme="dark"
            toastStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

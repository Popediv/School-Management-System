import api from './api';

export const authService = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  adminResetPassword: (id, newPassword) => api.post(`/auth/admin-reset/${id}`, { newPassword }),
};

export const studentService = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, d) => api.put(`/students/${id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  promote: (id, d) => api.post(`/students/${id}/promote`, d),
  delete: (id) => api.delete(`/students/${id}`),
};

export const teacherService = {
  getAll: (params) => api.get('/teachers', { params }),
  getById: (id) => api.get(`/teachers/${id}`),
  create: (data) => api.post('/teachers', data),
  update: (id, d) => api.put(`/teachers/${id}`, d),
  delete: (id) => api.delete(`/teachers/${id}`),
  assign: (data) => api.post('/teachers/assign', data),
};

export const classService = {
  getAll: () => api.get('/classes'),
  getById: (id) => api.get(`/classes/${id}`),
  create: (data) => api.post('/classes', data),
  update: (id, d) => api.put(`/classes/${id}`, d),
  delete: (id) => api.delete(`/classes/${id}`),
};

export const attendanceService = {
  mark: (data) => api.post('/attendance', data),
  getByClass: (id, p) => api.get(`/attendance/class/${id}`, { params: p }),
  getStudent: (id, p) => api.get(`/attendance/student/${id}`, { params: p }),
  getReport: (params) => api.get('/attendance/report', { params }),
};

export const resultService = {
  upload: (data) => api.post('/results', data),
  getStudent: (id, p) => api.get(`/results/student/${id}`, { params: p }),
  getReportCard: (id, p) => api.get(`/results/report-card/${id}`, { params: p }),
  calculate: (data) => api.post('/results/calculate', data),
};

export const feeService = {
  getStudentFees: (id) => api.get(`/fees/student/${id}`),
  createInvoice: (data) => api.post('/fees/invoice', data),
  recordPayment: (data) => api.post('/fees/pay', data),
  getReceipt: (id) => api.get(`/fees/receipt/${id}`),
  getOutstanding: () => api.get('/fees/outstanding'),
  getStructures: () => api.get('/fees/structures'),
  createStructure: (data) => api.post('/fees/structures', data),
  deleteStructure: (id) => api.delete(`/fees/structures/${id}`),
  bulkInvoice: (data) => api.post('/fees/bulk-invoice', data),
};

export const idCardService = {
  generate: (id) => api.get(`/idcards/${id}`),
  bulkExport: (ids) => api.post('/idcards/bulk', { ids }),
};

export const notificationService = {
  getAll: (p) => api.get('/notifications', { params: p }),
  create: (data) => api.post('/notifications', data),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const subjectService = {
  getAll: () => api.get('/subjects'),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
};

export const schemeService = {
  getAll: (params) => api.get('/schemes', { params }),
  getById: (id) => api.get(`/schemes/${id}`),
  create: (data) => api.post('/schemes', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, d) => api.put(`/schemes/${id}`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/schemes/${id}`),
  extractFromPdf: (data) => api.post('/schemes/extract-pdf', data),
};

export const subjectPdfService = {
  getAll: (params) => api.get('/subject-pdfs', { params }),
  upload: (data) => api.post('/subject-pdfs', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/subject-pdfs/${id}`),
  copyToAllTerms: (data) => api.post('/subject-pdfs/copy-to-all', data),
  // Returns the URL to pass to an iframe — token embedded as query param for inline viewing
  getViewUrl: (id) => {
    const token = localStorage.getItem('sms_token');
    return `/api/subject-pdfs/${id}/view?token=${token}#toolbar=0&navpanes=0&scrollbar=0`;
  },
};


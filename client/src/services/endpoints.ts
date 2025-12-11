// Central place for API endpoint paths
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/session',
    roles: '/auth/roles',
    changePassword: '/auth/change-password',
    verifyPassword: '/auth/verify-password',
  },
  students: {
    list: '/students',
    create: '/students',
    get: (id: string) => `/students/${id}`,
    update: (id: string) => `/students/${id}`,
    delete: (id: string) => `/students/${id}`,
  },
  teachers: {
    list: '/teachers',
    create: '/teachers',
    get: (id: string) => `/teachers/${id}`,
    update: (id: string) => `/teachers/${id}`,
    delete: (id: string) => `/teachers/${id}`,
  },
  assignments: {
    list: '/assignments',
    create: '/assignments',
    remove: '/assignments',
    byTeacher: (id: string) => `/assignments/teacher/${id}`,
    byClass: (id: string) => `/assignments/class/${id}`,
  },
  staff: {
    list: '/staff',
    create: '/staff',
    get: (id: string) => `/staff/${id}`,
    update: (id: string) => `/staff/${id}`,
    delete: (id: string) => `/staff/${id}`,
    pay: (id: string) => `/staff/${id}/pay`,
  },
  classes: {
    list: '/classes',
    create: '/classes',
    get: (id: string) => `/classes/${id}`,
    update: (id: string) => `/classes/${id}`,
    delete: (id: string) => `/classes/${id}`,
  },
  attendance: {
    mark: '/attendance',
    bulkMark: '/attendance/bulk',
    byClass: (classId: string) => `/attendance/class/${classId}`,
    byClassRange: (classId: string) => `/attendance/class/${classId}/range`,
    byStudent: (studentId: string) => `/attendance/student/${studentId}`,
    delete: (id: string) => `/attendance/${id}`,
  },
  schedules: {
    list: '/teacher/grades',
    create: '/teacher/grades',
    update: (id: string) => `/teacher/grades/${id}`,
  },
  permissions: '/permissions',
  notifications: '/notifications/check',
  payments: {
    list: '/payments',
    create: '/payments',
    get: (id: string) => `/payments/${id}`,
  },
  income: {
    list: '/income',
    create: '/income',
    get: (id: string) => `/income/${id}`,
    delete: (id: string) => `/income/${id}`,
  },
  expenses: {
    list: '/expenses',
    create: '/expenses',
    get: (id: string) => `/expenses/${id}`,
    delete: (id: string) => `/expenses/${id}`,
  },
  feeStructures: {
    list: '/fee-structures',
    create: '/fee-structures',
    get: (id: string) => `/fee-structures/${id}`,
  },
  audit: {
    list: '/audit',
  },
  reports: {
    list: '/reports',
    create: '/reports',
  },
  aggregations: '/aggregations',
  settings: {
    list: '/settings',
    update: (key: string) => `/settings/${key}`,
  },
  events: {
    list: '/events',
    create: '/events',
  },
  payroll: {
    list: '/payroll',
    create: '/payroll',
    get: (id: string) => `/payroll/${id}`,
    initialize: (id: string) => `/payroll/${id}/initialize`,
    recordPayment: (itemId: string) => `/payroll/${itemId}/payment`,
    staffHistory: (staffId: string) => `/payroll/staff/${staffId}/history`,
    addDeductions: (itemId: string) => `/payroll/${itemId}/deductions`,
    generateReport: (id: string) => `/payroll/${id}/report`,
  },
};

export default ENDPOINTS;

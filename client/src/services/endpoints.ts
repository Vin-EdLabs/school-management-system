// Central place for API endpoint paths
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    session: '/auth/session',
    roles: '/auth/roles',
  },
  students: '/students',
  classes: '/classes',
  permissions: '/permissions',
  notifications: '/notifications/check',
  payments: '/payments',
  income: '/income',
  expenses: '/expenses',
  feeStructures: '/fee-structures',
  audit: '/audit',
  reports: '/reports',
  aggregations: '/aggregations',
  settings: '/settings',
  events: '/events',
};

export default ENDPOINTS;

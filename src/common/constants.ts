export const ROLE = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
} as const;

export const USER_ROLES = [ROLE.ADMIN, ROLE.HR, ROLE.MANAGER, ROLE.EMPLOYEE] as const;

export const EMPLOYMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
} as const;

export const EMPLOYMENT_STATUSES = [
  EMPLOYMENT_STATUS.ACTIVE,
  EMPLOYMENT_STATUS.INACTIVE,
  EMPLOYMENT_STATUS.ON_LEAVE,
] as const;

export const DEPARTMENT_SORT_FIELDS = ['name', 'createdAt'] as const;

export const EMPLOYEE_SORT_FIELDS = [
  'firstName',
  'lastName',
  'workEmail',
  'joiningDate',
  'createdAt',
] as const;

export const SORT_ORDERS = ['asc', 'desc'] as const;

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;
export const REFRESH_COOKIE_NAME = 'refresh_token';
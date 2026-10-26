export interface EmployeeListFilters {
  page: number;
  limit: number;
  departmentId?: string;
  status?: string;
  search?: string;
  sortBy: 'firstName' | 'lastName' | 'workEmail' | 'joiningDate' | 'createdAt';
  order: 'asc' | 'desc';
  scope?: { role: string; employeeId: string };
}
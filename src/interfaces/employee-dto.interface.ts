export interface EmployeeDto {
  id: string;
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
  phone: string | null;
  departmentId: string;
  managerId: string | null;
  jobTitle: string;
  joiningDate: string;
  employmentStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
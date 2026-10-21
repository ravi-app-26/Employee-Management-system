import { Employee } from '../entities/employee.entity';

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

export function toEmployeeDto(
  employee: Employee,
  identity: { firstName: string | null; lastName: string | null; workEmail: string | null },
): EmployeeDto {
  return {
    id: employee.id,
    firstName: identity.firstName,
    lastName: identity.lastName,
    workEmail: identity.workEmail,
    phone: employee.phone,
    departmentId: employee.departmentId,
    managerId: employee.managerId,
    jobTitle: employee.jobTitle,
    joiningDate: employee.joiningDate,
    employmentStatus: employee.employmentStatus,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
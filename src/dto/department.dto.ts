import { Department } from '../entities/department.entity';
export interface DepartmentDto {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDepartmentDto(department: Department): DepartmentDto {
  return {
    id: department.id,
    name: department.name,
    description: department.description,
    createdAt: department.createdAt,
    updatedAt: department.updatedAt,
  };
}
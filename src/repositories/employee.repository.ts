import { Repository } from 'typeorm';
import { Employee, User } from '../entities';
import { EMPLOYEE_SORT_FIELDS } from '../validators';

type SortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export type EmployeeListRecord = Employee & {
  firstName: string | null;
  lastName: string | null;
  workEmail: string | null;
};

const SORT_COLUMNS: Record<SortField, string> = {
  firstName: 'u.first_name',
  lastName: 'u.last_name',
  workEmail: 'u.work_email',
  joiningDate: 'e.joiningDate',
  createdAt: 'e.createdAt',
};

export interface EmployeeListFilters {
  page: number;
  limit: number;
  departmentId?: string;
  status?: string;
  search?: string;
  sortBy: SortField;
  order: 'asc' | 'desc';
  scope?: { role: string; employeeId: string };
}

export class EmployeeRepository {
  private static escapeLike(value: string): string {
    return value.replace(/[!%_]/g, '!$&');
  }

  static async list(
    employeeRepository: Repository<Employee>,
    filters: EmployeeListFilters,
  ): Promise<{
    data: EmployeeListRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
  const query = employeeRepository.createQueryBuilder('e');
  query
    .leftJoin(User, 'u', 'u.employee_id = e.id')
    .addSelect('u.first_name', 'user_first_name')
    .addSelect('u.last_name', 'user_last_name')
    .addSelect('u.work_email', 'user_work_email');

  if (filters.scope?.role === 'manager') {
    query.andWhere('(e.managerId = :scopeEmployeeId OR e.id = :scopeEmployeeId)', {
      scopeEmployeeId: filters.scope.employeeId,
    });
  } else if (filters.scope && !['admin', 'hr'].includes(filters.scope.role)) {
    query.andWhere('e.id = :scopeEmployeeId', {
      scopeEmployeeId: filters.scope.employeeId,
    });
  }

  if (filters.departmentId) {
    query.andWhere('e.departmentId = :departmentId', {
      departmentId: filters.departmentId,
    });
  }

  if (filters.status) {
    query.andWhere('e.employmentStatus = :status', { status: filters.status });
  }

  if (filters.search) {
    query.andWhere(
      "(u.first_name ILIKE :search ESCAPE '!' OR u.last_name ILIKE :search ESCAPE '!' OR u.work_email ILIKE :search ESCAPE '!' OR e.job_title ILIKE :search ESCAPE '!')",
      { search: `%${EmployeeRepository.escapeLike(filters.search)}%` },
    );
  }

  query
    .orderBy(SORT_COLUMNS[filters.sortBy], filters.order.toUpperCase() as 'ASC' | 'DESC')
    .addOrderBy('e.id', 'ASC')
    .offset((filters.page - 1) * filters.limit)
    .limit(filters.limit);

  const { raw, entities: employees } = await query.getRawAndEntities();
  const total = await query.getCount();

  return {
    data: employees.map((employee, index): EmployeeListRecord => ({
      ...employee,
      firstName: raw[index].user_first_name ?? null,
      lastName: raw[index].user_last_name ?? null,
      workEmail: raw[index].user_work_email ?? null,
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
    };
  }
}
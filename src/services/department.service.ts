import { NotFoundError } from '../errors/app-error';
import { Department } from '../entities/department.entity';
import { DepartmentRepository } from '../repositories/department.repository';
import type { DepartmentDto } from '../interfaces';
import { DEPARTMENT_SORT_FIELDS, toDepartmentDto } from '../validators/department.validator';
import {
  getDepartmentListCache,
  invalidateDepartmentListCache,
  storeDepartmentListCache,
} from '../providers/redis/department-cache.provider';

type DepartmentSortField = (typeof DEPARTMENT_SORT_FIELDS)[number];
type DepartmentListResult = {
  data: DepartmentDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  async create(input: { name: string; description?: string }): Promise<DepartmentDto> {
    const created = await this.repo.create(input);
    await invalidateDepartmentListCache();
    return toDepartmentDto(created);
  }

  async list(
    page: number,
    limit: number,
    sortBy: DepartmentSortField,
    order: 'asc' | 'desc',
  ) {
    const query = { page, limit, sortBy, order };
    const cached = await getDepartmentListCache(query);
    if (cached.value !== null) return cached.value as DepartmentListResult;

    const result = await this.repo.findAll(page, limit, sortBy, order);
    const response: DepartmentListResult = {
      ...result,
      data: result.data.map(toDepartmentDto),
    };
    await storeDepartmentListCache(cached.version, query, response);
    return response;
  }

  async update(
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<DepartmentDto> {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Department not found');
    await invalidateDepartmentListCache();
    return toDepartmentDto(updated);
  }
}
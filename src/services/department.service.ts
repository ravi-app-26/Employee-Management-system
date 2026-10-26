import { NotFoundError } from '../errors/app-error';
import { Department } from '../entities/department.entity';
import { DepartmentRepository } from '../repositories/department.repository';
import type { DepartmentDto } from '../interfaces';
import { DEPARTMENT_SORT_FIELDS, toDepartmentDto } from '../validators/department.validator';

type DepartmentSortField = (typeof DEPARTMENT_SORT_FIELDS)[number];

export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  async create(input: { name: string; description?: string }): Promise<DepartmentDto> {
    return toDepartmentDto(await this.repo.create(input));
  }

  async list(
    page: number,
    limit: number,
    sortBy: DepartmentSortField,
    order: 'asc' | 'desc',
  ) {
    const result = await this.repo.findAll(page, limit, sortBy, order);
    return { ...result, data: result.data.map(toDepartmentDto) };
  }

  async update(
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<DepartmentDto> {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Department not found');
    return toDepartmentDto(updated);
  }
}
import { NotFoundError } from '../errors/app-error';
import { Department } from '../entities/department.entity';
import { DepartmentRepository } from '../repositories/department.repository';
import { DepartmentDto, toDepartmentDto } from '../dto/department.dto';

export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  async create(input: { name: string; description?: string }): Promise<DepartmentDto> {
    return toDepartmentDto(await this.repo.create(input));
  }

  async list(page: number, limit: number) {
    const result = await this.repo.findAll(page, limit);
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
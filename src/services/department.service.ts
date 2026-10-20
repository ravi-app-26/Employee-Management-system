import { NotFoundError } from '../errors/app-error';
import { Department } from '../entities/department.entity';
import { DepartmentRepository } from '../repositories/department.repository';

export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  create(input: { name: string; description?: string }): Promise<Department> {
    return this.repo.create(input);
  }

 // ...existing code...
  list(page: number, limit: number) {
    return this.repo.findAll(page, limit);
  }
// ...existing code...

  async update(
    id: string,
    input: { name?: string; description?: string | null },
  ): Promise<Department> {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Department not found');
    return updated;
  }
}
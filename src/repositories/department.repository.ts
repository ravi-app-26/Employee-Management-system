import { DataSource, Repository } from 'typeorm';
import { Department } from '../entities/department.entity';

export class DepartmentRepository {
  private readonly repo: Repository<Department>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(Department);
  }

  create(data: { name: string; description?: string }): Promise<Department> {
    return this.repo.save(
      this.repo.create({ name: data.name, description: data.description ?? null }),
    );
  }

  // ...existing code...
  async findAll(page: number, limit: number) {
    const [data, total] = await this.repo.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
// ...existing code...

  findById(id: string): Promise<Department | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(
    id: string,
    fields: { name?: string; description?: string | null },
  ): Promise<Department | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    if (fields.name !== undefined) existing.name = fields.name;
    if (fields.description !== undefined) existing.description = fields.description;

    return this.repo.save(existing);
  }
}
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Department } from '../entities/department.entity';
import type { DepartmentDto } from '../interfaces';
import {
  getDepartmentListCache,
  invalidateDepartmentListCache,
  storeDepartmentListCache,
} from '../providers/redis/department-cache.provider';
import { DepartmentRepository } from '../repositories/department.repository';
import { DepartmentService } from './department.service';

jest.mock('../providers/redis/department-cache.provider', () => ({
  getDepartmentListCache: jest.fn(),
  invalidateDepartmentListCache: jest.fn(),
  storeDepartmentListCache: jest.fn(),
}));

const department = Object.assign(new Department(), {
  id: 'department-id',
  name: 'Engineering',
  description: 'Builds software',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
});

describe('DepartmentService Redis list cache', () => {
  const create = jest.fn<DepartmentRepository['create']>();
  const findAll = jest.fn<DepartmentRepository['findAll']>();
  const update = jest.fn<DepartmentRepository['update']>();
  const repository = { create, findAll, update } as unknown as DepartmentRepository;
  let service: DepartmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDepartmentListCache).mockResolvedValue({ version: '2', value: null });
    jest.mocked(storeDepartmentListCache).mockResolvedValue(undefined);
    jest.mocked(invalidateDepartmentListCache).mockResolvedValue(undefined);
    create.mockResolvedValue(department);
    findAll.mockResolvedValue({
      data: [department],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    update.mockResolvedValue(department);
    service = new DepartmentService(repository);
  });

  it('returns a cached list without querying PostgreSQL', async () => {
    const cached: { data: DepartmentDto[]; pagination: object } = {
      data: [{
        id: department.id,
        name: department.name,
        description: department.description,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    jest.mocked(getDepartmentListCache).mockResolvedValue({ version: '2', value: cached });

    await expect(service.list(1, 20, 'name', 'asc')).resolves.toBe(cached);

    expect(findAll).not.toHaveBeenCalled();
  });

  it('fills the query-specific cache after a miss', async () => {
    const result = await service.list(1, 20, 'name', 'asc');

    expect(findAll).toHaveBeenCalledWith(1, 20, 'name', 'asc');
    expect(storeDepartmentListCache).toHaveBeenCalledWith(
      '2',
      { page: 1, limit: 20, sortBy: 'name', order: 'asc' },
      result,
    );
  });

  it('invalidates department list entries after successful writes', async () => {
    await service.create({ name: 'Engineering' });
    await service.update(department.id, { name: 'Platform' });

    expect(invalidateDepartmentListCache).toHaveBeenCalledTimes(2);
  });
});
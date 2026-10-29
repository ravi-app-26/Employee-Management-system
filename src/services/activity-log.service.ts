import { DataSource } from 'typeorm';

export class ActivityLogService {
  constructor(private readonly dataSource: DataSource) {}

  async logHrDepartmentEmployees(): Promise<number> {
    const inserted: Array<{ id: string }> = await this.dataSource.query(
      `INSERT INTO activity_log (employee_id, description)
       SELECT e.id, $2
       FROM employees e
       JOIN departments d ON d.id = e.department_id
       WHERE LOWER(d.name) = LOWER($1)
       RETURNING id`,
      ['Human Resources', 'This emp department is hr'],
    );

    return inserted.length;
  }

  async logEmployeesWithoutPhone(): Promise<number> {
  const inserted: Array<{ id: string }> = await this.dataSource.query(
    `INSERT INTO activity_log (employee_id, description)
     SELECT e.id, $1
     FROM employees e
     WHERE e.phone IS NULL
     RETURNING id`,
    ['not have phone no'],
  );

  return inserted.length;
}
}
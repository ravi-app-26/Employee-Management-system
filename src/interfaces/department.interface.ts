export interface ListDepartmentsQuery {
  page: number;
  limit: number;
  sortBy: 'name' | 'createdAt';
  order: 'asc' | 'desc';
}
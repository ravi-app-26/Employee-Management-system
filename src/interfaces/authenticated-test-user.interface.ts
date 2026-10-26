export interface AuthenticatedTestUser {
  id: string;
  employeeId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshCookie: string;
}
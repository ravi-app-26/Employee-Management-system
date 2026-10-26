export interface DevUser {
  email: string;
  first: string;
  last: string;
  title: string;
  dept: string;
  role: string;
  managerEmail?: string;
}
declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        role: string;
        employeeId: string;
      };
    }
  }
}
export {};
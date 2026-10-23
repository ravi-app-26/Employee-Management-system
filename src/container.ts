import { AppDataSource } from './config/database';
import { RefreshTokenRepository, UserRepository } from './repositories';
import {
  AuthService,
  AuthorizationService,
  DepartmentService,
  EmployeeDocumentService,
  EmployeeService,
  UserService,
} from './services';
import {
  AuthController,
  DepartmentController,
  EmployeeController,
  EmployeeDocumentController,
  UserController,
} from './controllers';
import { AuthenticationMiddleware } from './middlewares';
import { DepartmentRepository } from './repositories';
import { Department } from './entities/department.entity';
import { Employee } from './entities/employee.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { User } from './entities/user.entity';

const userRepository = new UserRepository(AppDataSource);
const refreshTokenRepository = new RefreshTokenRepository(AppDataSource);

export const authService = new AuthService(userRepository, refreshTokenRepository);
export const authorizationService = new AuthorizationService(userRepository);
export const authController = new AuthController(authService);
export const authenticateMiddleware = AuthenticationMiddleware.create(authService);

const departmentRepository = new DepartmentRepository(AppDataSource);
const departmentService = new DepartmentService(departmentRepository);
export const departmentController = new DepartmentController(departmentService);

const employeeService = new EmployeeService(
  AppDataSource.getRepository(Employee),
  AppDataSource.getRepository(Department),
  AppDataSource.getRepository(User),
  userRepository,
);
export const employeeController = new EmployeeController(employeeService);

export const employeeDocumentService = new EmployeeDocumentService(
  AppDataSource,
  AppDataSource.getRepository(EmployeeDocument),
  AppDataSource.getRepository(Employee),
);
export const employeeDocumentController = new EmployeeDocumentController(employeeDocumentService);
export const userController = new UserController(new UserService(AppDataSource));
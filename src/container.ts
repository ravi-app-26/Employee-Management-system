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
} from './controllers/v1';
import { AuthenticationMiddleware } from './middlewares';
import { DepartmentRepository } from './repositories';
import { Department } from './entities/department.entity';
import { Employee } from './entities/employee.entity';
import { EmployeeDocument } from './entities/employee-document.entity';
import { User } from './entities/user.entity';
import { ActivityLogService } from './services/activity-log.service';
import { SessionExpiryEventService } from './services/session-expiry-event.service';
import { SessionAuditService } from './services/session-audit.service';
import { SessionAuditController } from './controllers/v1/session-audit.controller';
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
  refreshTokenRepository,
);
export const employeeController = new EmployeeController(employeeService);

export const employeeDocumentService = new EmployeeDocumentService(
  AppDataSource,
  AppDataSource.getRepository(EmployeeDocument),
  AppDataSource.getRepository(Employee),
);
export const employeeDocumentController = new EmployeeDocumentController(employeeDocumentService);
export const userController = new UserController(new UserService(AppDataSource, refreshTokenRepository));
export const activityLogService = new ActivityLogService(AppDataSource);
export const sessionExpiryEventService = new SessionExpiryEventService(refreshTokenRepository);
export const sessionAuditService = new SessionAuditService(AppDataSource);
export const sessionAuditController = new SessionAuditController(sessionAuditService);
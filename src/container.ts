import { AppDataSource } from './config/database';
import { UserRepository } from './repositories/user.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { AuthService } from './services/auth.service';
import { AuthorizationService } from './services/authorization.service';
import { AuthController } from './controllers/auth.controller';
import { AuthenticationMiddleware } from './middlewares/authenticate';
import { DepartmentRepository } from './repositories/department.repository';
import { DepartmentService } from './services/department.service';
import { DepartmentController } from './controllers/department.controller';
// ...existing code...
import { Employee } from './entities/employee.entity';
import { Department } from './entities/department.entity';
import { User } from './entities/user.entity';
import { EmployeeService } from './services/employee.service';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeDocumentController } from './controllers/employee-document.controller';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeeDocumentService } from './services/employee-document.service';
// ...existing code...
const userRepository = new UserRepository(AppDataSource);
const refreshTokenRepository = new RefreshTokenRepository(AppDataSource);

export const authService = new AuthService(userRepository, refreshTokenRepository);
export const authorizationService = new AuthorizationService(userRepository);
export const authController = new AuthController(authService);
export const authenticateMiddleware = AuthenticationMiddleware.create(authService);
const departmentRepository = new DepartmentRepository(AppDataSource);
const departmentService = new DepartmentService(departmentRepository);
export const departmentController = new DepartmentController(departmentService);


// ...existing code...
const employeeService = new EmployeeService(
	AppDataSource.getRepository(Employee),
	AppDataSource.getRepository(Department),
	AppDataSource.getRepository(User),
);
export const employeeController = new EmployeeController(employeeService);
export const employeeDocumentService = new EmployeeDocumentService(
	AppDataSource,
	AppDataSource.getRepository(EmployeeDocument),
	AppDataSource.getRepository(Employee),
);
export const employeeDocumentController = new EmployeeDocumentController(employeeDocumentService);
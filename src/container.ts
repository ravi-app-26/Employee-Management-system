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
import { AuthController } from './controllers';
import { AuthenticationMiddleware } from './middlewares';
import { DepartmentRepository } from './repositories';
import { DepartmentController } from './controllers';
// ...existing code...
<<<<<<< Updated upstream
import { Employee } from './entities/employee.entity';
import { Department } from './entities/department.entity';
import { User } from './entities/user.entity';
import { EmployeeService } from './services/employee.service';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeDocumentController } from './controllers/employee-document.controller';
import { EmployeeDocument } from './entities/employee-document.entity';
import { EmployeeDocumentService } from './services/employee-document.service';
<<<<<<< Updated upstream
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
=======
=======
import { Department, Employee, User } from './entities';
import { EmployeeController, EmployeeDocumentController } from './controllers';
import { EmployeeDocument } from './entities';
import { UserController } from './controllers';
>>>>>>> Stashed changes
>>>>>>> Stashed changes
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
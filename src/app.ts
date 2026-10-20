import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { RequestIdMiddleware } from './middlewares/request-id';
import { NotFoundMiddleware } from './middlewares/not-found';
import { ErrorHandlerMiddleware } from './middlewares/error-handler';
import { AuthRoutes } from './routes/auth.routes';
import { DepartmentRoutes } from './routes/department.routes';
import { EmployeeRoutes } from './routes/employee.routes';
import { HealthController } from './controllers/health.controller';
import { EmployeeDocumentRoutes } from './routes/employee-document.routes';
import { DocumentRoutes } from './routes/document.routes';
import { RateLimitMiddleware } from './middlewares/rate-limiter';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import {
  authController,
  authenticateMiddleware,
  authorizationService,
  departmentController,
  employeeController,
  employeeDocumentController,
} from './container';

export const app = express();

app.use(RequestIdMiddleware.handle);
app.use(RateLimitMiddleware.handle);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get('/health', HealthController.handle);
app.get('/health/live', HealthController.live);
app.get('/health/ready', HealthController.ready);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(
  '/api/v1/auth',
  AuthRoutes.create(authController, authenticateMiddleware, authorizationService),
);

app.use(
  '/api/v1/departments',
  DepartmentRoutes.create(departmentController, authenticateMiddleware, authorizationService),
);

app.use(
  '/api/v1/employees',
  EmployeeRoutes.create(employeeController, authenticateMiddleware, authorizationService),
);
app.use(
  '/api/v1/employees',
  EmployeeDocumentRoutes.create(employeeDocumentController, authenticateMiddleware),
);
app.use(
  '/api/v1/documents',
  DocumentRoutes.create(employeeDocumentController, authenticateMiddleware),
);

app.use(NotFoundMiddleware.handle);
app.use(ErrorHandlerMiddleware.handle);
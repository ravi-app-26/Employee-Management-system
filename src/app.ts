import 'reflect-metadata';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ErrorHandlerMiddleware, RateLimitMiddleware, RequestIdMiddleware } from './middlewares';
import { AuthRoutes } from './routes/auth.routes';
import { DepartmentRoutes } from './routes/department.routes';
import { EmployeeRoutes } from './routes/employee.routes';
import { HealthController } from './controllers';
import { EmployeeDocumentRoutes } from './routes/employee-document.routes';
import { DocumentRoutes } from './routes/document.routes';
<<<<<<< Updated upstream
import { UserRoutes } from './routes/user.routes';
import { RateLimitMiddleware } from './middlewares/rate-limiter';
import { env } from './config/env';
=======
<<<<<<< Updated upstream
import { RateLimitMiddleware } from './middlewares/rate-limiter';
=======
import { UserRoutes } from './routes/user.routes';
import { env } from './config/env';
>>>>>>> Stashed changes
>>>>>>> Stashed changes
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import {
  authController,
  authenticateMiddleware,
  authorizationService,
  departmentController,
  employeeController,
  employeeDocumentController,
  userController,
} from './container';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY);
app.use(RequestIdMiddleware.handle);
app.use(RateLimitMiddleware.handle);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGINS }));
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
app.use('/api/v1', UserRoutes.create(userController, authenticateMiddleware, authorizationService));

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
  EmployeeDocumentRoutes.create(employeeDocumentController, authenticateMiddleware, authorizationService),
);
app.use(
  '/api/v1/documents',
  DocumentRoutes.create(employeeDocumentController, authenticateMiddleware, authorizationService),
);

app.use(ErrorHandlerMiddleware.notFound);
app.use(ErrorHandlerMiddleware.handle);
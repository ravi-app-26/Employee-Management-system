import cron from 'node-cron';
import { logger } from '../../config/logger';
import { ActivityLogService } from '../../services';

export function startHrActivityLogCron(activityLogService: ActivityLogService) {
  return cron.schedule('0 * * * *', async () => {
    try {
      const insertedCount =
        await activityLogService.logHrDepartmentEmployees();

      logger.info(
        { insertedCount },
        'Hourly HR activity logs created',
      );
    } catch (error) {
      logger.error(
        { err: error },
        'Hourly HR activity log job failed',
      );
    }
  });
}

export function startEmployeesWithoutPhoneCron(
  activityLogService: ActivityLogService,
) {
  return cron.schedule('*/30 * * * *', async () => {
    try {
      const insertedCount =
        await activityLogService.logEmployeesWithoutPhone();

      logger.info(
        { insertedCount },
        'Employees-without-phone activity logs created',
      );
    } catch (error) {
      logger.error(
        { err: error },
        'Employees-without-phone activity log job failed',
      );
    }
  });
}
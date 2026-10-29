import cron from 'node-cron';
import { logger } from '../../config/logger';
import { SessionAuditService } from '../../services/session-audit.service';

export function startSessionAuditSummaryCron(service: SessionAuditService) {
  return cron.schedule('5 0 * * *', async () => {
    try {
      const days = await service.generateDailySummaries(90);
      logger.info({ days, outcome: 'completed' }, 'Daily session audit summaries generated');
    } catch (error) {
      logger.error({ errorName: error instanceof Error ? error.name : 'UnknownError', outcome: 'failed' }, 'Daily session audit summary job failed');
    }
  });
}

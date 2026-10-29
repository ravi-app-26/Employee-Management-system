import { describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { SessionAuditService } from './session-audit.service';

describe('SessionAuditService', () => {
  it('refreshes bounded daily summaries before returning metrics', async () => {
    const query = jest.fn<(...args: any[]) => Promise<unknown[]>>().mockResolvedValue([]);
    const service = new SessionAuditService({ query } as unknown as DataSource);

    await service.metrics(7);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual([7]);
    expect(query.mock.calls[1][1]).toEqual([7]);
    expect(query.mock.calls[0][0]).toContain('INSERT INTO session_audit_daily_summaries');
    expect(query.mock.calls[1][0]).toContain('FROM session_audit_daily_summaries');
  });

  it('caps the requested metrics window at 90 days', async () => {
    const query = jest.fn<(...args: any[]) => Promise<unknown[]>>().mockResolvedValue([]);
    const service = new SessionAuditService({ query } as unknown as DataSource);

    await service.metrics(500);

    expect(query.mock.calls[0][1]).toEqual([90]);
    expect(query.mock.calls[1][1]).toEqual([90]);
  });
});
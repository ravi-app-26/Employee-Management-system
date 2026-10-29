import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('./redis.provider', () => ({
  redisClient: {
    isReady: true,
    configGet: jest.fn<(...args: [string]) => Promise<Record<string, string>>>(),
    configSet: jest.fn<(...args: [string, string]) => Promise<string>>(),
  },
}));

import { enableRedisExpiryNotifications } from './session-expiry.subscriber';
import { redisClient } from './redis.provider';

const mockRedisClient = redisClient as unknown as {
  isReady: boolean;
  configGet: jest.Mock<(...args: [string]) => Promise<Record<string, string>>>;
  configSet: jest.Mock<(...args: [string, string]) => Promise<string>>;
};

describe('enableRedisExpiryNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.isReady = true;
    mockRedisClient.configGet.mockResolvedValue({ 'notify-keyspace-events': 'K' });
    mockRedisClient.configSet.mockResolvedValue('OK');
  });

  it('preserves existing flags and enables keyevent expiry flags', async () => {
    await expect(enableRedisExpiryNotifications()).resolves.toBe(true);
    expect(mockRedisClient.configSet).toHaveBeenCalledWith('notify-keyspace-events', 'KEx');
  });

  it('does not rewrite an existing all-events configuration', async () => {
    mockRedisClient.configGet.mockResolvedValue({ 'notify-keyspace-events': 'A' });
    await expect(enableRedisExpiryNotifications()).resolves.toBe(true);
    expect(mockRedisClient.configSet).not.toHaveBeenCalled();
  });

  it('returns false when Redis config changes are unavailable', async () => {
    mockRedisClient.configGet.mockRejectedValue(new Error('permission denied'));
    await expect(enableRedisExpiryNotifications()).resolves.toBe(false);
  });

  it('returns false when Redis is disconnected', async () => {
    mockRedisClient.isReady = false;
    await expect(enableRedisExpiryNotifications()).resolves.toBe(false);
    expect(mockRedisClient.configGet).not.toHaveBeenCalled();
  });
});

export type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

export interface ThrottlerStorage {
  increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord>;
}

export const ORDER_LIMIT = 10;
export const ORDER_TTL_MS = 60_000;
export const WITHDRAWAL_LIMIT = 5;
export const WITHDRAWAL_TTL_MS = 60_000;

type EvalClient = {
  eval: (script: string, numKeys: number, ...args: string[]) => Promise<unknown>;
};

const INCREMENT_LUA = `
local hits = redis.call('INCR', KEYS[1])
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ttl)
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ttl)
  pttl = ttl
end
local blocked = 0
local timeToBlock = 0
if hits > limit then
  blocked = 1
  if block > 0 then
    local blockKey = KEYS[1] .. ':block'
    if redis.call('EXISTS', blockKey) == 0 then
      redis.call('SET', blockKey, '1', 'PX', block)
    end
    local blockTtl = redis.call('PTTL', blockKey)
    if blockTtl > 0 then
      timeToBlock = math.ceil(blockTtl / 1000)
    end
  else
    timeToBlock = math.ceil(pttl / 1000)
  end
end
return { hits, math.ceil(pttl / 1000), blocked, timeToBlock }
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly client: EvalClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const raw = await this.client.eval(INCREMENT_LUA, 1, key, String(ttl), String(limit), String(blockDuration));
    const [totalHits, timeToExpire, blocked, timeToBlockExpire] = asNumbers(raw);
    return {
      totalHits,
      timeToExpire,
      isBlocked: blocked === 1,
      timeToBlockExpire,
    };
  }
}

function asNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [0, 0, 0, 0];
  }
  return value.map((entry) => Number(entry));
}

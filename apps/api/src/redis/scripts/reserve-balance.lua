-- Atomically reserve a user's point balance.
-- KEYS[1] wallet balance, integer minor units (scale 10000)
-- KEYS[2] hold key for this reservation token
-- ARGV[1] amount in minor units (positive integer string)
-- ARGV[2] reservation token
-- ARGV[3] hold ttl seconds
-- Returns {1, token, balance} or {0, reason}

local amount = tonumber(ARGV[1])
if amount == nil or amount <= 0 or amount ~= math.floor(amount) then
  return {0, 'INVALID_AMOUNT'}
end

if redis.call('EXISTS', KEYS[2]) == 1 then
  return {1, ARGV[2], 'ALREADY'}
end

if redis.call('EXISTS', KEYS[1]) == 0 then
  return {0, 'NO_WALLET'}
end

local balance = tonumber(redis.call('GET', KEYS[1]))
if balance == nil or balance < amount then
  return {0, 'INSUFFICIENT'}
end

local next_balance = redis.call('DECRBY', KEYS[1], amount)
if tonumber(next_balance) < 0 then
  redis.call('INCRBY', KEYS[1], amount)
  return {0, 'INSUFFICIENT'}
end

redis.call('SET', KEYS[2], ARGV[1], 'EX', tonumber(ARGV[3]))
return {1, ARGV[2], tostring(next_balance)}

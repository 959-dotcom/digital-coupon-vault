-- Release a reservation. The hold value is the minor-unit amount.
-- KEYS[1] wallet balance
-- KEYS[2] hold key
-- ARGV[1] reservation token (must match the hold key's token segment; checked by the caller key)
-- Returns {1, 'RELEASED'} or {0, reason}. Missing holds are not refunded twice.

if redis.call('EXISTS', KEYS[2]) == 0 then
  return {0, 'MISSING'}
end

local amount = tonumber(redis.call('GET', KEYS[2]))
if amount == nil or amount <= 0 then
  redis.call('DEL', KEYS[2])
  return {0, 'INVALID_AMOUNT'}
end

redis.call('INCRBY', KEYS[1], amount)
redis.call('DEL', KEYS[2])
return {1, 'RELEASED'}

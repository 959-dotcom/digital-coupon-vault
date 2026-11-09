-- Credit minor units when the wallet key already exists.
-- KEYS[1] wallet balance
-- ARGV[1] amount minor units
local amount = tonumber(ARGV[1])
if amount == nil or amount <= 0 or amount ~= math.floor(amount) then
  return {0, 'INVALID_AMOUNT'}
end
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {0, 'NO_WALLET'}
end
local next_balance = redis.call('INCRBY', KEYS[1], amount)
return {1, tostring(next_balance)}

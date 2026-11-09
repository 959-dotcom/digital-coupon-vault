-- Drop a hold after the ledger commit without refunding the balance.
-- KEYS[1] hold key
redis.call('DEL', KEYS[1])
return 1

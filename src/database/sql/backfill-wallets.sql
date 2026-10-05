-- Create a wallet for every existing user that does not already have one.
INSERT INTO wallet (id, "userId", balance, currency, "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  u.id::varchar,
  0,
  'NGN',
  true,
  CURRENT_TIMESTAMP(6),
  CURRENT_TIMESTAMP(6)
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1
  FROM wallet w
  WHERE w."userId" = u.id::varchar
);

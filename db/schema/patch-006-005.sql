-- -- drop new stored procedures

-- DROP PROCEDURE `forgotPasswordVerified_2`;
-- DROP PROCEDURE `updateLockedAt_1`;
-- DROP PROCEDURE `emailRecord_2`;

-- -- drop lockedAt column from accounts

-- ALTER TABLE accounts DROP COLUMN lockedAt;

-- UPDATE dbMetadata SET value = '5' WHERE name = 'schema-patch-level';

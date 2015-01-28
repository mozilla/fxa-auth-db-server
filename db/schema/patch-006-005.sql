-- -- Drop all of the stored procedures we added.

-- DROP PROCEDURE `resetAccount_2`;
-- DROP PROCEDURE `deleteAccount_2`;
-- DROP PROCEDURE `forgotPasswordVerified_2`;
-- DROP PROCEDURE `createPasswordChangeToken_2`;
-- DROP PROCEDURE `createPasswordForgotToken_2`;
-- DROP PROCEDURE `createAccountResetToken_2`;

-- -- make sure passwordChangeTokens(uid) is unique
-- -- ie. only one row for each accounts.uid
-- ALTER TABLE passwordChangeTokens DROP INDEX `uid`;

-- UPDATE dbMetadata SET value = '5' WHERE name = 'schema-patch-level';

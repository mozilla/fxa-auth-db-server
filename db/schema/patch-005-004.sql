-- Drop all of the stored procedures we added.

-- dbMetadata
-- DROP PROCEDURE `dbMetadata_v1`;

-- deletes
-- DROP PROCEDURE `resetAccount_v1`;
-- DROP PROCEDURE `deletePasswordChangeToken_v1`;
-- DROP PROCEDURE `deletePasswordForgotToken_v1`;
-- DROP PROCEDURE `deleteAccountResetToken_v1`;
-- DROP PROCEDURE `deleteKeyFetchToken_v1`;
-- DROP PROCEDURE `deleteSessionToken_v1`;
-- DROP PROCEDURE `deleteAccount_v1`;

-- updates
-- DROP PROCEDURE `updateLocale_v1`;
-- DROP PROCEDURE `forgotPasswordVerified_v1`;
-- DROP PROCEDURE `verifyEmail_v1`;
-- DROP PROCEDURE `updatePasswordForgotToken_v1`;

-- selects
-- DROP PROCEDURE `account_v1`;
-- DROP PROCEDURE `emailRecord_v1`;
-- DROP PROCEDURE `passwordChangeToken_v1`;
-- DROP PROCEDURE `passwordForgotToken_v1`;
-- DROP PROCEDURE `accountResetToken_v1`;
-- DROP PROCEDURE `keyFetchToken_v1`;
-- DROP PROCEDURE `sessionToken_v1`;
-- DROP PROCEDURE `accountDevices_v1`;
-- DROP PROCEDURE `accountExists_v1`;

-- inserts
-- DROP PROCEDURE `createPasswordChangeToken_v1`;
-- DROP PROCEDURE `createPasswordForgotToken_v1`;
-- DROP PROCEDURE `createAccountResetToken_v1`;
-- DROP PROCEDURE `createKeyFetchToken_v1`;
-- DROP PROCEDURE `createSessionToken_v1`;
-- DROP PROCEDURE `createAccount_v1`;

-- UPDATE dbMetadata SET value = '4' WHERE name = 'schema-patch-level';

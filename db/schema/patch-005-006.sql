-- Allow access to all stored procedures for the fxa user.

GRANT EXECUTE ON PROCEDURE accountDevices_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE accountExists_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE accountResetToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE account_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createAccountResetToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createAccount_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createKeyFetchToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createPasswordChangeToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createPasswordForgotToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE createSessionToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE dbMetadata_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deleteAccountResetToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deleteAccount_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deleteKeyFetchToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deletePasswordChangeToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deletePasswordForgotToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE deleteSessionToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE emailRecord_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE forgotPasswordVerified_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE keyFetchToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE passwordChangeToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE passwordForgotToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE prune TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE resetAccount_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE sessionToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE updateLocale_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE updatePasswordForgotToken_1 TO 'fxa'@'127.0.0.1';
GRANT EXECUTE ON PROCEDURE verifyEmail_1 TO 'fxa'@'127.0.0.1';

UPDATE dbMetadata SET value = '6' WHERE name = 'schema-patch-level';

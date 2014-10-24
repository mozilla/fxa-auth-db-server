-- Add a lockedAt column for account locking.

ALTER TABLE accounts ADD COLUMN lockedAt BIGINT UNSIGNED DEFAULT NULL;

-- Create/Update stored procedures for new functionality.

-- emailRecord v2
CREATE PROCEDURE `emailRecord_2` (
    IN `inEmail` VARCHAR(255)
)
BEGIN
    SELECT
        a.uid,
        a.email,
        a.normalizedEmail,
        a.emailVerified,
        a.emailCode,
        a.kA,
        a.wrapWrapKb,
        a.verifierVersion,
        a.verifyHash,
        a.authSalt,
        a.verifierSetAt,
        a.lockedAt
    FROM
        accounts a
    WHERE
        a.normalizedEmail = LOWER(inEmail)
    ;
END;

-- updateLockedAt v1
CREATE PROCEDURE `updateLockedAt_1` (
    IN `inLockedAt` BIGINT UNSIGNED,
    IN `inUid` BINARY(16)
)
BEGIN
    UPDATE accounts SET lockedAt = inLockedAt WHERE uid = inUid;
END;

CREATE PROCEDURE `forgotPasswordVerified_2` (
    IN `inPasswordForgotTokenId` BINARY(32),
    IN `inAccountResetTokenId` BINARY(32),
    IN `inTokenData` BINARY(32),
    IN `inUid` BINARY(16),
    IN `inCreatedAt` BIGINT UNSIGNED
)
BEGIN

    START TRANSACTION;

    DELETE FROM passwordForgotTokens WHERE tokenId = inPasswordForgotTokenId;

    INSERT INTO accountResetTokens(
        tokenId,
        tokenData,
        uid,
        createdAt
    )
    VALUES(
        inAccountResetTokenId,
        inTokenData,
        inUid,
        inCreatedAt
    );

    UPDATE accounts SET emailVerified = true, lockedAt = null WHERE uid = inUid;

    COMMIT;

END;

UPDATE dbMetadata SET value = '6' WHERE name = 'schema-patch-level';

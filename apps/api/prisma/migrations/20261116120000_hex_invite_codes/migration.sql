-- Old base64url invite codes can contain '_' or '-', which chat apps strip when pasted.
-- Replace those codes with 32-char hex (gen_random_uuid is cryptographically random, built into Postgres 13+).
UPDATE "Space"
SET "inviteCode" = replace(gen_random_uuid()::text, '-', '')
WHERE "inviteCode" ~ '[^0-9a-f]';

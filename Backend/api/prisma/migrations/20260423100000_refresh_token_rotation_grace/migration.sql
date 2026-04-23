-- Grace-window support for refresh-token rotation.
-- When the server rotates a refresh token, it now stamps revokedAt + the id
-- of the replacement. A concurrent refresh call that arrives with the
-- already-revoked token within 60 seconds can be matched back to the
-- replacement (via static-pages.service equivalent logic in auth.service),
-- preventing the second tab / parallel request from being incorrectly
-- logged out.

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "replacedByTokenId" TEXT;

CREATE INDEX IF NOT EXISTS "refresh_tokens_replacedByTokenId_idx"
  ON "refresh_tokens"("replacedByTokenId");

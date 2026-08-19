-- A stored false was decided by a rule that no longer exists: a film whose keyframes
-- carry leading pictures was refused for copying, which sent whole open-GOP films
-- through an encoder. Setting those back to null is what the scan reads as "never
-- probed", so it works them out again under the rule that replaced it.
--
-- A stored true is left alone. The new rule refuses strictly less, so anything
-- copyable under the old one is copyable under this one.
UPDATE "media_item" SET "canCopySegments" = NULL WHERE "canCopySegments" = false;

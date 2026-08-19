-- What the probe decided about a file is written here once and read forever after, and
-- the scan only looks again where a column is null. A change to the probing rules moves
-- neither a file's size nor its modification time, so nothing would ever revisit a row
-- holding an answer the rules no longer give -- which is why 0038 had to null those rows
-- by hand. Recording which version of the rules produced a row lets the scan work that
-- out for itself.
--
-- Null on every existing row, which the scan reads as a version it cannot vouch for, so
-- each is probed once more under the current rules and stamped from then on.
ALTER TABLE "media_item" ADD COLUMN "probeVersion" integer;

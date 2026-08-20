-- Whether this profile publishes what it is watching to Discord. Off for everybody who already
-- exists and off for everybody made afterwards, because somebody has to ask for it: a household
-- media server that told everyone's friends what they were watching without being asked would be a
-- different product, and an apology.
--
-- Safe in one step, unlike 0041, because it carries a default — every existing row gets false rather
-- than nothing.
ALTER TABLE "viewer_profile" ADD COLUMN "showsWhatIamWatching" boolean DEFAULT false NOT NULL;
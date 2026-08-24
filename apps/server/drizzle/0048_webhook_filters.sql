-- What a subscription wants told to it, beyond which events it named.
--
-- An empty object is the whole of the default and means "everything, the way it has always been
-- delivered". Every field inside is optional with its own default, so a row written before this
-- column existed reads back as the same subscription it was — which is what keeps existing
-- subscriptions delivering untouched rather than quietly stopping.
ALTER TABLE "webhook_subscription" ADD COLUMN "filters" jsonb DEFAULT '{}'::jsonb NOT NULL;

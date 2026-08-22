-- The job queue's own schema, renamed with the product.
--
-- pg-boss keeps every queue, its jobs and its archive in a schema it is given the name of, and it
-- does not go looking: pointed at a name that is not there it creates an empty one and starts
-- afresh. Every job already queued would still be sitting in the old schema, invisible, and the
-- work they stand for — a scan somebody started, a library still being read — would simply never
-- happen.
--
-- Renaming the schema moves all of it in one statement, which is why this is a migration rather
-- than a change of string.
--
-- Guarded on both sides. A deployment that predates the rename has `flux_jobs` and gets it renamed;
-- a database created after it has `valence_jobs` already and this does nothing. Neither is an error,
-- because this file runs against both.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'flux_jobs')
     AND NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'valence_jobs')
  THEN
    ALTER SCHEMA flux_jobs RENAME TO valence_jobs;
  END IF;
END
$$;

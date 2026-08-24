-- The job queue's own functions, renamed with the schema that holds them.
--
-- `ALTER SCHEMA ... RENAME` moves every table, index and function into the new name, but it does
-- not read what is written inside them. pg-boss builds its PL/pgSQL with the schema it was given
-- spelled out in the body, so `create_queue`, `delete_queue` and the two `job_table_run` functions
-- came through the rename still addressing `flux_jobs.queue` — a schema that no longer exists.
-- Nothing failed until the server next started a queue, which is the first thing it does.
--
-- Each function is read back with its own definition, the old schema swapped for the new, and
-- replaced in place. Rewriting them from a copy kept here would pin the queue to whatever pg-boss
-- looked like the day this was written; asking the database what it currently has does not.
--
-- Guarded by the same condition that selects them. Once no function mentions `flux_jobs` the loop
-- has nothing to run, so this is safe on a database created after the rename and on one that has
-- already had it.
DO $$
DECLARE
  candidate oid;
  definition text;
BEGIN
  FOR candidate IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'valence_jobs'
      AND p.prosrc LIKE '%flux_jobs%'
  LOOP
    definition := replace(pg_get_functiondef(candidate), 'flux_jobs', 'valence_jobs');
    EXECUTE definition;
  END LOOP;
END
$$;

INSERT INTO "role_permission" ("roleId", "permission")
SELECT "id", 'account.keys' FROM "role"
ON CONFLICT DO NOTHING;

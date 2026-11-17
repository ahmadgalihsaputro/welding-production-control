INSERT INTO "Machine" ("id", "code", "name", "line", "processes", "status", "createdAt", "updatedAt")
VALUES
  ('canonical-machine-robot-g', 'LINE-ROBOT-G', 'Robot G', 'Robot G', ARRAY[]::TEXT[], 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('canonical-machine-robot-h', 'LINE-ROBOT-H', 'Robot H', 'Robot H', ARRAY[]::TEXT[], 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('canonical-machine-robot-a', 'LINE-ROBOT-A', 'Robot A', 'Robot A', ARRAY[]::TEXT[], 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

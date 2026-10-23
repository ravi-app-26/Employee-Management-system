-- Up Migration
INSERT INTO permissions (name, description) VALUES
  ('document:upload', 'Upload employee documents'),
  ('document:read', 'List and download employee documents'),
  ('document:delete', 'Soft-delete employee documents')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE (r.name IN ('admin', 'hr', 'employee') AND p.name IN ('document:upload', 'document:read', 'document:delete'))
   OR (r.name = 'manager' AND p.name = 'document:read')
ON CONFLICT DO NOTHING;

-- Down Migration
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND p.name IN ('document:upload', 'document:read', 'document:delete')
  AND r.name IN ('admin', 'hr', 'manager', 'employee');

DELETE FROM permissions
WHERE name IN ('document:upload', 'document:read', 'document:delete');
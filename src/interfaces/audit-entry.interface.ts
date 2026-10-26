export interface AuditEntry {
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
}
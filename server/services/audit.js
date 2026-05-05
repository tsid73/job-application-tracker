export function createAuditLogger(pool) {
  return {
    async log(req, event, client = pool) {
      await client.query(
        `
          INSERT INTO audit_events (
            application_id,
            target_type,
            target_id,
            action,
            details,
            actor_ip,
            actor_user_agent
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          event.applicationId || null,
          event.targetType,
          String(event.targetId),
          event.action,
          event.details || null,
          readActorIp(req),
          req?.headers?.['user-agent'] || null
        ]
      );
    },

    async list({ applicationId, limit = 50 }) {
      const result = await pool.query(
        `
          SELECT id, application_id, target_type, target_id, action, details, actor_ip, actor_user_agent, created_at
          FROM audit_events
          WHERE ($1::bigint IS NULL OR application_id = $1)
          ORDER BY created_at DESC
          LIMIT $2
        `,
        [applicationId || null, limit]
      );
      return result.rows;
    }
  };
}

function readActorIp(req) {
  return String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'local')
    .split(',')[0]
    .trim();
}

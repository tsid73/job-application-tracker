import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadApi } from '../server/services/readApi.js';

test('getNotifications excludes follow-up and todo reminders', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("'interview' AS type")) {
        return { rows: [{ id: 1, type: 'interview', due_date: '2026-08-02' }] };
      }
      if (sql.includes("'follow_up' AS type")) {
        return { rows: [{ id: 2, type: 'follow_up', due_date: '2026-08-03' }] };
      }
      if (sql.includes("'todo' AS type")) {
        return { rows: [{ id: 3, type: 'todo', due_date: '2026-08-04' }] };
      }
      if (sql.includes("'next_action' AS type")) {
        return { rows: [{ id: 4, type: 'next_action', due_date: '2026-08-05' }] };
      }
      return { rows: [] };
    },
  };

  const readApi = createReadApi({ pool, audit: {} });
  const result = await readApi.getNotifications();

  assert.deepEqual(
    result.notifications.map((notification) => notification.type),
    ['interview', 'next_action'],
  );
});

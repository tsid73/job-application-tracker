import { config } from '../config.js';

export function explainConnectionError(error) {
  if (!isConnectionRefused(error)) return error;

  const message = [
    'PostgreSQL is not reachable.',
    '',
    `The app tried to connect to: ${config.databaseUrl}`,
    '',
    'Start PostgreSQL, then rerun the command.',
    '',
    'With Docker:',
    '  docker compose up -d',
    '  npm run migrate',
    '',
    'With local PostgreSQL:',
    '  create a database named job_tracker',
    '  set DATABASE_URL in .env if your user, password, host, or port differs',
    '  npm run migrate',
    '',
    'Original error:',
    `  ${error.code || 'ERROR'} ${error.message}`
  ].join('\n');

  const explained = new Error(message);
  explained.cause = error;
  return explained;
}

function isConnectionRefused(error) {
  return error?.code === 'ECONNREFUSED' || /ECONNREFUSED/.test(error?.message || '');
}

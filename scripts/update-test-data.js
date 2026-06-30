/**
 * Enriches existing test data for stress-testing the insights page.
 * Run while server is stopped: node scripts/update-test-data.js
 */
import { pool } from '../server/db/pool.js';

async function run() {
  console.log('Adding tags...');
  await pool.exec(`
    INSERT INTO tags (name) VALUES
      ('Node.js'), ('React'), ('Python'), ('Django'), ('TypeScript'),
      ('AWS'), ('Azure'), ('GCP'), ('Docker'), ('Kubernetes'),
      ('PostgreSQL'), ('MongoDB'), ('Redis'), ('GraphQL'), ('REST API'),
      ('Full Stack'), ('Frontend'), ('DevOps'), ('Remote'), ('Hybrid'),
      ('Senior'), ('Mid-Level'), ('Junior'), ('Startup'), ('Enterprise'),
      ('FinTech'), ('HealthTech'), ('EdTech'), ('AI/ML'), ('Data Science'),
      ('SaaS'), ('B2B'), ('Open Source'), ('Agile'), ('Scrum')
    ON CONFLICT (name) DO NOTHING;
  `);

  console.log('Inserting new applications...');
  await pool.exec(`
    INSERT INTO applications (company_name, role_title, job_link, job_description, status, applied_date, notes) VALUES
      ('Vercel','Senior Engineer','https://example.com/vercel-1','Frontend infra at scale.','offer', CURRENT_DATE - INTERVAL '180 days','Strong team culture'),
      ('Stripe','Backend Engineer','https://example.com/stripe-1','Payments platform, Node.js/Go.','accepted', CURRENT_DATE - INTERVAL '160 days','Dream company'),
      ('Linear','Product Engineer','https://example.com/linear-1','Tool builder, TypeScript heavy.','rejected', CURRENT_DATE - INTERVAL '155 days','Cultural fit question'),
      ('Notion','Full Stack Engineer','https://example.com/notion-2','Editor infra, React + Node.','interview_scheduled', CURRENT_DATE - INTERVAL '10 days', NULL),
      ('Figma','Platform Engineer','https://example.com/figma-1','Design tooling, C++/Rust.','rejected', CURRENT_DATE - INTERVAL '150 days','Too much C++'),
      ('Loom','Backend Engineer','https://example.com/loom-1','Video infra, Node.js.','ghosted', CURRENT_DATE - INTERVAL '145 days', NULL),
      ('Airtable','Software Engineer','https://example.com/airtable-1','Spreadsheet DB hybrid.','withdrawn', CURRENT_DATE - INTERVAL '140 days','Took too long'),
      ('Retool','Frontend Engineer','https://example.com/retool-1','Low code platform, React.','rejected', CURRENT_DATE - INTERVAL '135 days', NULL),
      ('Planetscale','Database Engineer','https://example.com/planetscale-1','MySQL-compatible serverless DB.','offer', CURRENT_DATE - INTERVAL '130 days','Salary negotiating'),
      ('Railway','DevOps Engineer','https://example.com/railway-1','Cloud deploy platform.','ghosted', CURRENT_DATE - INTERVAL '125 days', NULL),
      ('Render','Backend Engineer','https://example.com/render-1','PaaS infrastructure.','applied', CURRENT_DATE - INTERVAL '5 days', NULL),
      ('Fly.io','Systems Engineer','https://example.com/flyio-1','Global edge compute.','applied', CURRENT_DATE - INTERVAL '3 days', NULL),
      ('Supabase','Full Stack Engineer','https://example.com/supabase-1','Postgres-based BaaS.','interview_scheduled', CURRENT_DATE - INTERVAL '8 days', NULL),
      ('Hasura','GraphQL Engineer','https://example.com/hasura-1','Instant GraphQL APIs.','rejected', CURRENT_DATE - INTERVAL '120 days', NULL),
      ('Prisma','Developer Relations','https://example.com/prisma-1','ORM tooling, Node ecosystem.','withdrawn', CURRENT_DATE - INTERVAL '115 days','Not DevRel interest'),
      ('Clerk','Security Engineer','https://example.com/clerk-1','Auth platform, zero trust.','ghosted', CURRENT_DATE - INTERVAL '110 days', NULL),
      ('Resend','Backend Engineer','https://example.com/resend-1','Email delivery infra.','applied', CURRENT_DATE - INTERVAL '2 days', NULL),
      ('Trigger.dev','Full Stack Engineer','https://example.com/trigger-1','Background jobs platform.','applied', CURRENT_DATE - INTERVAL '1 day', NULL),
      ('Inngest','Platform Engineer','https://example.com/inngest-1','Event-driven functions platform.','rejected', CURRENT_DATE - INTERVAL '105 days', NULL),
      ('Upstash','Data Engineer','https://example.com/upstash-1','Serverless Redis & Kafka.','ghosted', CURRENT_DATE - INTERVAL '100 days', NULL),
      ('Neon','Database Engineer','https://example.com/neon-1','Serverless Postgres.','offer', CURRENT_DATE - INTERVAL '95 days','Good equity'),
      ('Xata','Backend Engineer','https://example.com/xata-1','Serverless DB with search.','rejected', CURRENT_DATE - INTERVAL '90 days', NULL),
      ('Turso','Systems Engineer','https://example.com/turso-1','libSQL edge DB.','applied', CURRENT_DATE - INTERVAL '7 days', NULL),
      ('Val Town','Full Stack Engineer','https://example.com/valtown-1','Social JS runtime.','ghosted', CURRENT_DATE - INTERVAL '85 days', NULL),
      ('Deno','Runtime Engineer','https://example.com/deno-1','JS/TS runtime.','rejected', CURRENT_DATE - INTERVAL '80 days', NULL),
      ('Bun','Systems Engineer','https://example.com/bun-1','Fast JS runtime, Zig.','applied', CURRENT_DATE - INTERVAL '4 days', NULL),
      ('Cloudflare','Edge Engineer','https://example.com/cf-1','Workers platform.','accepted', CURRENT_DATE - INTERVAL '75 days','Great benefits'),
      ('FastMail','Backend Engineer','https://example.com/fastmail-1','Email infrastructure.','withdrawn', CURRENT_DATE - INTERVAL '70 days', NULL),
      ('Postmark','Platform Engineer','https://example.com/postmark-1','Transactional email.','ghosted', CURRENT_DATE - INTERVAL '65 days', NULL),
      ('Sendgrid','Software Engineer','https://example.com/sendgrid-1','Email delivery at scale.','rejected', CURRENT_DATE - INTERVAL '60 days', NULL),
      ('Datadog','Backend Engineer','https://example.com/datadog-1','Observability platform.','interview_scheduled', CURRENT_DATE - INTERVAL '6 days', NULL),
      ('Grafana','Full Stack Engineer','https://example.com/grafana-1','Open source observability.','rejected', CURRENT_DATE - INTERVAL '55 days', NULL),
      ('Honeycomb','Platform Engineer','https://example.com/honeycomb-1','Observability tooling.','applied', CURRENT_DATE - INTERVAL '6 days', NULL),
      ('Sentry','SDK Engineer','https://example.com/sentry-1','Error monitoring.','offer', CURRENT_DATE - INTERVAL '50 days','Evaluating'),
      ('LogRocket','Frontend Engineer','https://example.com/logrocket-1','Session replay.','rejected', CURRENT_DATE - INTERVAL '48 days', NULL),
      ('FullStory','Data Engineer','https://example.com/fullstory-1','Behavioral analytics.','ghosted', CURRENT_DATE - INTERVAL '45 days', NULL),
      ('Amplitude','Backend Engineer','https://example.com/amplitude-1','Product analytics.','withdrawn', CURRENT_DATE - INTERVAL '40 days', NULL),
      ('Mixpanel','Data Engineer','https://example.com/mixpanel-1','Event analytics.','rejected', CURRENT_DATE - INTERVAL '35 days', NULL),
      ('PostHog','Full Stack Engineer','https://example.com/posthog-1','Open source analytics.','interview_scheduled', CURRENT_DATE - INTERVAL '9 days', NULL),
      ('Cal.com','Full Stack Engineer','https://example.com/calcom-1','Open source scheduling.','applied', CURRENT_DATE - INTERVAL '5 days', NULL),
      ('Documenso','Backend Engineer','https://example.com/documenso-1','Open source DocuSign.','applied', CURRENT_DATE - INTERVAL '3 days', NULL),
      ('Formbricks','Full Stack Engineer','https://example.com/formbricks-1','Open source survey tool.','rejected', CURRENT_DATE - INTERVAL '30 days', NULL),
      ('Typeform','Frontend Engineer','https://example.com/typeform-1','Form builder UX.','ghosted', CURRENT_DATE - INTERVAL '28 days', NULL),
      ('Tally','Full Stack Engineer','https://example.com/tally-1','Simple form builder.','applied', CURRENT_DATE - INTERVAL '2 days', NULL),
      ('Paperform','Backend Engineer','https://example.com/paperform-1','Form automation.','rejected', CURRENT_DATE - INTERVAL '25 days', NULL),
      ('Linear Clone Co','Product Engineer','https://example.com/linear2-1','Issue tracker.','applied', CURRENT_DATE - INTERVAL '1 day', NULL),
      ('Plane','Full Stack Engineer','https://example.com/plane-1','Open source Jira.','applied', CURRENT_DATE - INTERVAL '4 days', NULL),
      ('Height','Product Engineer','https://example.com/height-1','AI task management.','interview_scheduled', CURRENT_DATE - INTERVAL '11 days', NULL),
      ('Basecamp','Backend Engineer','https://example.com/basecamp-1','Project management.','rejected', CURRENT_DATE - INTERVAL '20 days', NULL),
      ('ClickUp','Full Stack Engineer','https://example.com/clickup-1','All-in-one productivity.','ghosted', CURRENT_DATE - INTERVAL '18 days', NULL),
      ('Monday.com','Backend Engineer','https://example.com/monday-1','Work management SaaS.','withdrawn', CURRENT_DATE - INTERVAL '15 days', NULL),
      ('Asana','Platform Engineer','https://example.com/asana-1','Team project tracking.','applied', CURRENT_DATE - INTERVAL '6 days', NULL),
      ('Wrike','Backend Engineer','https://example.com/wrike-1','Enterprise project management.','rejected', CURRENT_DATE - INTERVAL '12 days', NULL),
      ('Jira (Atlassian)','Platform Engineer','https://example.com/atlassian-1','Issue tracker at scale.','applied', CURRENT_DATE - INTERVAL '3 days', NULL),
      ('GitHub','Backend Engineer','https://example.com/github-1','Developer platform.','offer', CURRENT_DATE - INTERVAL '200 days','Equity is good'),
      ('GitLab','Full Stack Engineer','https://example.com/gitlab-1','DevOps platform.','rejected', CURRENT_DATE - INTERVAL '190 days', NULL),
      ('Bitbucket','Backend Engineer','https://example.com/bitbucket-1','Git hosting.','withdrawn', CURRENT_DATE - INTERVAL '185 days', NULL),
      ('Sourcegraph','Backend Engineer','https://example.com/sourcegraph-1','Code intelligence.','ghosted', CURRENT_DATE - INTERVAL '175 days', NULL),
      ('Codeium','ML Engineer','https://example.com/codeium-1','AI coding assistant.','applied', CURRENT_DATE - INTERVAL '7 days', NULL),
      ('Cursor','Full Stack Engineer','https://example.com/cursor-1','AI code editor.','applied', CURRENT_DATE - INTERVAL '2 days', NULL),
      ('Warp','Systems Engineer','https://example.com/warp-1','AI terminal.','rejected', CURRENT_DATE - INTERVAL '165 days', NULL),
      ('Zed','Systems Engineer','https://example.com/zed-1','Collaborative code editor, Rust.','applied', CURRENT_DATE - INTERVAL '5 days', NULL);
  `);

  console.log('Adding status history for new apps...');
  await pool.exec(`
    INSERT INTO status_history (application_id, from_status, to_status, changed_at)
    SELECT a.id, NULL, a.status, a.applied_date::timestamptz
    FROM applications a
    WHERE NOT EXISTS (SELECT 1 FROM status_history sh WHERE sh.application_id = a.id);
  `);

  console.log('Adding transition history (applied → final status) for timing metrics...');
  await pool.exec(`
    INSERT INTO status_history (application_id, from_status, to_status, changed_at)
    SELECT
      a.id,
      'applied',
      a.status,
      (a.applied_date + (random() * 21 + 5)::int)::timestamptz
    FROM applications a
    WHERE a.status IN ('interview_scheduled','offer','accepted','rejected','withdrawn','ghosted')
      AND NOT EXISTS (
        SELECT 1 FROM status_history sh
        WHERE sh.application_id = a.id AND sh.from_status IS NOT NULL
      );
  `);

  console.log('Assigning tags to applications...');
  await pool.exec(`
    WITH tag_ids AS (SELECT id, name FROM tags),
    app_ids AS (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM applications)
    INSERT INTO application_tags (application_id, tag_id)
    SELECT DISTINCT a.id, t.id
    FROM app_ids a
    JOIN tag_ids t ON (a.rn + t.id) % 5 < 3
    ON CONFLICT DO NOTHING;
  `);

  console.log('Verifying...');
  const r1 = await pool.query('SELECT count(*) FROM applications');
  const r2 = await pool.query('SELECT count(*) FROM tags');
  const r3 = await pool.query('SELECT count(*) FROM application_tags');
  const r4 = await pool.query(`
    SELECT round(avg(sh.changed_at::date - a.applied_date))::int AS avg_days
    FROM status_history sh
    JOIN applications a ON a.id = sh.application_id
    WHERE sh.to_status = 'interview_scheduled' AND sh.from_status IS NOT NULL
  `);
  console.log(`Applications: ${r1.rows[0].count}`);
  console.log(`Tags: ${r2.rows[0].count}`);
  console.log(`Tag assignments: ${r3.rows[0].count}`);
  console.log(`Avg days to interview: ${r4.rows[0].avg_days}`);

  await pool.end();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });

UPDATE target_companies
SET fit_notes = NULL
WHERE source = 'companies-and-links.html'
  AND fit_notes IS NOT NULL;

INSERT INTO job_boards (name, url, notes, is_active, last_checked_date)
VALUES
  ('Welcome to the Jungle', 'https://www.welcometothejungle.com/', 'Strong Europe-focused discovery for startups, scale-ups, and tech companies with useful company profiles.', TRUE, NULL),
  ('Relocate.me', 'https://relocate.me/', 'Tech jobs from companies offering relocation support or international hiring paths.', TRUE, NULL),
  ('Arbeitnow Visa Jobs', 'https://www.arbeitnow.com/visa-sponsorship-jobs', 'Germany-focused visa sponsorship job listings, useful for backend and software engineering searches.', TRUE, NULL),
  ('EnglishJobs Germany', 'https://englishjobs.de/', 'English-speaking jobs in Germany across engineering, product, data, and business roles.', TRUE, NULL),
  ('Make it in Germany', 'https://www.make-it-in-germany.com/', 'Official German portal for skilled-worker immigration, job search context, and visa guidance.', TRUE, NULL),
  ('We Work Remotely', 'https://weworkremotely.com/', 'Large remote job board with strong software engineering, product, design, and support coverage.', TRUE, NULL),
  ('Remote OK', 'https://remoteok.com/', 'High-volume remote board with strong filtering for software engineering and global remote roles.', TRUE, NULL),
  ('Arc', 'https://arc.dev/talent', 'Remote developer opportunities and talent marketplace for software engineers.', TRUE, NULL),
  ('FlexJobs', 'https://www.flexjobs.com/', 'Vetted remote and flexible jobs across tech, product, operations, and business roles.', TRUE, NULL),
  ('Jaabz', 'https://jaabz.com/', 'International tech roles with visa sponsorship, relocation, and remote-work filters.', TRUE, NULL),
  ('Noborders', 'https://www.noborders.io/', 'Global tech jobs focused on companies with visa sponsorship or relocation track records.', TRUE, NULL),
  ('Workbeyond', 'https://www.workbeyond.com/', 'Visa-sponsored global jobs with destination and relocation-oriented search context.', TRUE, NULL)
ON CONFLICT (name) DO NOTHING;

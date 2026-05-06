INSERT INTO job_boards (name, url, notes, is_active, last_checked_date)
VALUES
  ('LinkedIn Jobs', 'https://www.linkedin.com/jobs/', 'Broad coverage for tech, product, design, operations, and remote roles.', TRUE, NULL),
  ('Indeed', 'https://www.indeed.com/', 'High-volume general board with strong location filtering and salary signals.', TRUE, NULL),
  ('Glassdoor', 'https://www.glassdoor.com/Job/index.htm', 'Useful when you want company reviews, interview insights, and open roles in one place.', TRUE, NULL),
  ('Wellfound', 'https://wellfound.com/jobs', 'Widely used for startup hiring, early-stage teams, and direct founder/recruiter reachouts.', TRUE, NULL),
  ('Naukri', 'https://www.naukri.com/', 'Common default board for India-based hiring across engineering, support, analytics, and operations.', TRUE, NULL)
ON CONFLICT (name) DO NOTHING;

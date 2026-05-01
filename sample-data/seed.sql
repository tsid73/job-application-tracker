INSERT INTO cv_versions (file_path, original_name, mime_type, file_size, version_label, is_latest)
VALUES ('sample-data/sample-cv.pdf', 'sample-cv.pdf', 'application/pdf', 650, 'General backend CV', TRUE);

INSERT INTO applications (company_name, job_link, job_description, status, applied_date, interview_date, notes)
VALUES
  (
    'Northstar Systems',
    'https://example.com/jobs/backend-engineer',
    'Backend engineer role focused on PostgreSQL, Node.js services, and operational tooling.',
    'interview_scheduled',
    CURRENT_DATE - INTERVAL '3 days',
    CURRENT_DATE + INTERVAL '4 days',
    'Review recent API design examples before the interview.'
  ),
  (
    'Plaintext Labs',
    NULL,
    'Full-stack role building small internal tools with vanilla JavaScript and PostgreSQL.',
    'applied',
    CURRENT_DATE - INTERVAL '1 day',
    NULL,
    NULL
  );

INSERT INTO application_cvs (application_id, cv_id)
SELECT a.id, c.id
FROM applications a
CROSS JOIN cv_versions c
WHERE c.original_name = 'sample-cv.pdf';

INSERT INTO status_history (application_id, from_status, to_status)
SELECT id, NULL, status FROM applications;

INSERT INTO tags (name) VALUES ('Backend'), ('Remote'), ('High Priority');

INSERT INTO application_tags (application_id, tag_id)
SELECT a.id, t.id
FROM applications a
JOIN tags t ON t.name IN ('Backend', 'High Priority')
WHERE a.company_name = 'Northstar Systems';

# GPT Workflow API

Use these REST endpoints from `D:\gpt_job_workflow` when the user explicitly says to run tracker updates. The tracker has no login; keep the base URL local or otherwise trusted.

Set the base URL from `D:\gpt_job_workflow\CONFIG.md`:

```powershell
$BaseUrl = "http://192.168.0.190:3000"
```

## Read

List active applications:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications"
```

List all applications, including archived:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications?archived=all"
```

Read one application:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications/123"
```

List CVs and choose a `cv_id`:

```powershell
Invoke-RestMethod "$BaseUrl/api/cv"
```

## Lookup Before Create

Use exact lookup before creating a tracker entry:

```powershell
$Query = [uri]::EscapeDataString("Acme Labs")
Invoke-RestMethod "$BaseUrl/api/applications/lookup?company_name=$Query"
```

Lookup by company and role:

```powershell
$Company = [uri]::EscapeDataString("Acme Labs")
$Role = [uri]::EscapeDataString("Senior Backend Engineer")
Invoke-RestMethod "$BaseUrl/api/applications/lookup?company_name=$Company&role_title=$Role"
```

Lookup by job link:

```powershell
$JobLink = [uri]::EscapeDataString("https://example.com/jobs/123")
Invoke-RestMethod "$BaseUrl/api/applications/lookup?job_link=$JobLink"
```

The lookup endpoint requires `company_name` or `job_link`.

## Create

Create with an existing `cv_id`:

```powershell
$Body = @{
  company_name = "Acme Labs"
  role_title = "Senior Backend Engineer"
  job_link = "https://example.com/jobs/123"
  job_description = "Backend role using Node.js, PostgreSQL, APIs, and operations tooling."
  status = "applied"
  salary = ""
  location = "Berlin, Germany"
  recruiter = ""
  contact_person = ""
  applied_date = "2026-06-14"
  interview_date = $null
  next_action = "Follow up"
  next_action_due_date = "2026-06-21"
  tags = "Backend, GPT Workflow"
  cv_id = 1
  notes = "Created from GPT workflow after run pending approval."
} | ConvertTo-Json

Invoke-RestMethod "$BaseUrl/api/applications" -Method Post -ContentType "application/json" -Body $Body
```

Create with multipart CV upload:

```powershell
curl.exe -X POST "$BaseUrl/api/applications" `
  -F "company_name=Acme Labs" `
  -F "role_title=Senior Backend Engineer" `
  -F "job_link=https://example.com/jobs/123" `
  -F "job_description=Backend role using Node.js, PostgreSQL, APIs, and operations tooling." `
  -F "status=applied" `
  -F "applied_date=2026-06-14" `
  -F "tags=Backend, GPT Workflow" `
  -F "notes=Created from GPT workflow after run pending approval." `
  -F "cv=@D:\Mega\Personal\CV_Resume\final-cv.pdf"
```

Creation requires either `job_link` or `job_description`, and a CV upload or valid `cv_id`.

## Update

Update selected fields:

```powershell
$Body = @{
  status = "interview_scheduled"
  interview_date = "2026-06-25"
  next_action = "Prepare interview notes"
  next_action_due_date = "2026-06-22"
  notes = "Recruiter screen scheduled."
} | ConvertTo-Json

Invoke-RestMethod "$BaseUrl/api/applications/123" -Method Put -ContentType "application/json" -Body $Body
```

The update endpoint merges with the existing row, so only changed fields are needed.

## Archive, Restore, Delete

Prefer archive for reversible removal:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications/123/archive" -Method Post
```

Restore an archived application:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications/123/restore" -Method Post
```

Hard delete only when explicitly intended:

```powershell
Invoke-RestMethod "$BaseUrl/api/applications/123" -Method Delete
```

## Workflow Rule

Do not call create/update/delete endpoints during analysis-only runs. Keep using the GPT workflow queue and create tracker entries only after the user says `run pending`. If the final CV is missing, skip that pending job unless the user explicitly overrides the CV gate.

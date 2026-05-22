# Security and Public Repo Checklist

## Intended Deployment

Run this app on:

- `localhost`
- a trusted private machine
- a private network behind your own access controls

Do not expose it directly to the public internet. The app has no built-in authentication.

## Keep Out Of Git

Do not commit:

- `.env`
- real API keys or AWS credentials
- uploaded CVs
- generated AI documents
- `data/`
- backup exports
- local database dumps

The current `.gitignore` excludes `.env`, `data/`, `uploads/`, `node_modules/`, logs, coverage, and build output.

## Before Making A Public Repo

Check:

```bash
git status --short
git ls-files | rg '(^\\.env$|^data/|^uploads/|backup|\\.zip$|\\.sql$)'
rg -n --hidden -g '!node_modules' -g '!data' -g '!uploads' -g '!package-lock.json' '(secret|api[_-]?key|access[_-]?key|token|password|private key|AKIA|ghp_|sk-)'
```

Expected tracked runtime files under `uploads/` are only `.gitkeep` placeholders.

## Deployment Hardening Needed For Public Access

Add these before any public deployment:

- authentication
- authorization for every user-owned record
- TLS termination
- trusted reverse proxy configuration
- secure cookies/session handling if auth is added
- production rate limits
- backup encryption
- private object storage
- monitoring and security logging

## Current App Controls

- Upload size limits
- JSON body size limits
- Basic API rate limits
- CV file extension, MIME, and signature checks
- Static serving limited to `public/`
- Stored file access limited to `uploads/`
- CSV formula-prefix escaping on export
- `noindex` headers for served pages

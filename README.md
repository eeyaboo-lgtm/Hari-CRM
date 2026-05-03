# Hari-CRM

Project management dashboard for ShelfPulse and RetailSuite.

## Structure

```
Hari-CRM/
├── backups/          # Auto-generated, gitignored — 5 rotating copies per project
│   ├── shelfpulse/
│   └── retailsuite/
├── dashboard/        # Dashboard HTML (coming soon)
├── scripts/
│   ├── backup.py     # Backup runner
│   └── .env.example  # Token template
└── .gitignore
```

## Backup Setup

1. Copy `scripts/.env.example` to `scripts/.env`
2. Fill in your GitHub tokens
3. Run: `python3 scripts/backup.py`

Keeps up to 5 rotating copies of `server.py` (ShelfPulse) and `app.py` (RetailSuite). Oldest is overwritten when limit is reached.

## Projects

| Project | Live | Render | GitHub |
|---|---|---|---|
| ShelfPulse | https://shelfpulse-j820.onrender.com | prj-d7nunhpkh4rs73bfg840 | eeyaboo-lgtm/shelfpulse |
| RetailSuite | https://retailsuite.onrender.com | prj-d7prlo6gvqtc73c3oo8g | eeyaboo-lgtm/retailsuite |

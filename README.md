# Telegram GitCode Hub

Telegram-first code repository workspace.

## Current MVP

- Repository workspace UI
- File tree and browser editor
- ZIP upload and unpacking in the browser
- ZIP export/download
- Local commit history prototype
- Arabic RTL interface

## Architecture target

Telegram Mini App → API → Supabase → StorageProvider

The next backend milestone is Telegram authentication, Supabase persistence, repository/file/commit tables, and server-side Telegram Bot integration. Secrets must remain server-side.

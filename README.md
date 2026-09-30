# XARK Web Services

Static browser-based services for the XARK website.

## Current services

- `/rr/` — Report Writer
- `/com/` — HTML PDF Compiler
- `/humanizer/` — AI Humanizer powered by the Clever AI embedded widget

The Report Writer is completely frontend-only. It uses HTML, CSS and JavaScript and stores drafts locally in the browser with `localStorage`.

The AI Humanizer is embedded from Clever AI and does not require a backend in this repository.

No backend, database, or account is required by the XARK services themselves.

## Deploy

This repository is designed for GitHub Pages.

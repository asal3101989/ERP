# Procurement Web Application

## Structure

- `server.js`: lightweight Node server and API
- `public/`: static web application pages
- `data/`: persisted application data
- `start.bat`: Windows launcher

## Run locally

1. Open a terminal in this folder.
2. Run `node server.js`
3. Open `http://localhost:3000`

On Windows, you can also double-click `start.bat`.

## Current live modules

- `Material Indent`: connected to the backend and persisted in `data/indents.json`

## API

- `GET /api/health`
- `GET /api/indents`
- `POST /api/indents`
- `PATCH /api/indents/:id/status`

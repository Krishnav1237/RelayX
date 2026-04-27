# Development Runbook

## 1) Prerequisites

- Node.js (modern version compatible with Next 16 and TypeScript toolchain)
- npm

## 2) Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 3) Run Services

### Backend

```bash
cd backend
npm run dev
```

- URL: `http://localhost:3001`
- Health check: `GET /health`

### Frontend

```bash
cd frontend
npm run dev
```

- URL: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard`
- API path used by UI: `/api/execute` (rewritten to backend)

## 4) Build Commands

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## 5) Linting

Frontend includes ESLint script:

```bash
cd frontend
npm run lint
```

Backend currently has no dedicated lint script in `package.json`.

## 6) Operational Notes

- Backend uses deterministic, static protocol candidates.
- Adapter files are placeholders and not active in runtime flow.
- Root-level `package-lock.json` exists but there is no root `package.json` with orchestrating scripts.

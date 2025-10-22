# VynixHR frontend

React 18, TypeScript, Vite, React Query, and accessible Radix dialogs power the local HR workspace.

From the repository root, run `python start.py` to prepare and launch the complete app.
For frontend-only development, run `npm install` and `npm run dev`; the backend must be available on port 5000.

## Code guide

- `src/hr/App.tsx`: sign-in, role-aware navigation, and the workspace shell.
- `src/hr/api.ts`: authenticated requests, query caching, and confirmed mutation feedback.
- `src/hr/types.ts`: API contracts shared across pages.
- `src/hr/ui.tsx`: reusable buttons, dialogs, status badges, and page states.
- `src/hr/`: individual pages and the responsive visual system.
- `src/routes/routes.tsx`: application routes.

Sessions use browser session storage. The frontend uses relative `/api/v1` requests through Vite's local proxy. No external fonts or image hosts are needed. The AI chat sends requests only to the local backend and displays the matched demo FAQ source.

Run `npm run build`, `npm run lint`, and `npm run format:check` before committing. `npm run format` applies consistent formatting.

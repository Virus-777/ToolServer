# Dashboard Frontend (React + Vite + Tailwind CSS)

Admin dashboard ("KingMaker") for the TailorResume Auth Server. The production build is
written to `../public`, which the Express server serves, so the built files are committed.

## Development

```bash
npm install
npm run dev        # http://localhost:3003, /api is proxied to http://localhost:8085
```

Start the backend first (`npm run dev` in the repository root). Always open the app through
the root URL and its routes (`/login`, `/users`, `/jobs`, …), never the source files directly.

## Production build

```bash
npm run build      # or, from the repository root: npm run frontend:build
```

The API base URL is same-origin (`/api`) by default; set `VITE_API_BASE` (see `.env.example`)
only when the API is hosted elsewhere.

## Structure

```
src/
  App.jsx                 Routing, public vs. admin layout, code-split pages
  components/
    ui.jsx                Button, Input/Select/Textarea, FormField, Card, DataTable, Badge, Tabs, …
    Modal.jsx             Modal + ConfirmModal (Escape / backdrop close, scroll lock)
    Pagination.jsx        Pager with page-size selector
    Sidebar.jsx           Navigation (responsive drawer on small screens)
    Login.jsx
  contexts/
    AuthContext.jsx       Session state, token verification, auto-logout on 401
    UIContext.jsx         useToast() notifications and promise-based useConfirm()
  hooks/useDebouncedValue.js
  pages/                  One file per route; pages/jobs/ holds the job tab, forms and block list
  services/api.js         Fetch wrapper + typed API groups (UsersAPI, JobsAPI, …)
  utils/format.js         Date / text helpers
```

## Conventions

- Feedback goes through `useToast()`; destructive actions ask with `await confirm({...})`.
- Tables are rendered with `DataTable` (`columns` describe headers and cell renderers).
- Job dates (`YYYY-MM-DD`) are treated as plain strings; never pass them through `new Date()`
  for display or editing, it shifts the day in negative UTC offsets.
- Authentication: the Users, GPT, History, Allowed Emails and Assembly Tokens pages require an
  admin session; Jobs and User Configs are reachable without logging in (by design).

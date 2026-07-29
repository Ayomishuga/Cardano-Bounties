# Planned Dependencies

These packages are **not currently installed**. They are earmarked for specific
upcoming features. When implementing the relevant feature, install the package
with `npm install <package-name>` before starting.

Do **not** install these preemptively — they add to bundle size and node_modules
without benefit until their feature is actively being built.

---

## UI Primitives

| Package | Intended version | Intended use |
|---|---|---|
| `@radix-ui/react-alert-dialog` | `^1.x` | Confirmation dialogs for destructive admin actions (cancel bounty, reject submission) |
| `@radix-ui/react-checkbox` | `^1.x` | Batch-select checkboxes in admin data tables |
| `@radix-ui/react-dialog` | `^1.x` | Replace current custom modal backdrop/overlay implementation |
| `@radix-ui/react-dropdown-menu` | `^2.x` | Context menus on bounty/submission table rows |
| `@radix-ui/react-progress` | `^1.x` | Progress bar in escrow verification step UI |
| `@radix-ui/react-select` | `^2.x` | Accessible filter/category selects in Explore and Admin pages |
| `@radix-ui/react-slot` | `^1.x` | Required dependency for class-variance-authority button patterns |
| `@radix-ui/react-tabs` | `^1.x` | Replace current custom tab implementations with accessible Radix tabs |
| `@radix-ui/react-toggle` | `^1.x` | Filter toggle buttons in admin queues |
| `@radix-ui/react-toggle-group` | `^1.x` | Multi-select status filter groups in admin bounty list |
| `@radix-ui/react-tooltip` | `^1.x` | Tooltips on truncated addresses, amounts, and action buttons |

---

## Data Tables

| Package | Intended version | Intended use |
|---|---|---|
| `@tanstack/react-table` | `^8.x` | Sortable, filterable, paginated data tables for `AdminBountiesPage`, `AdminHuntersPage`, `AdminPostersPage`. Replaces hand-rolled table sort logic. |
| `@tanstack/react-query` | `^5.x` | Server state caching and automatic background refetch for dashboard data. Replaces manual `useEffect` + `useCallback` + polling patterns. |

---

## Forms & Validation

| Package | Intended version | Intended use |
|---|---|---|
| `react-hook-form` | `^7.x` | Structured form state management for `PostBountyPage` and admin forms. Reduces uncontrolled re-renders vs current `useState` per field approach. |
| `zod` | `^4.x` | Runtime schema validation for API responses and form inputs. Pair with `react-hook-form` via `@hookform/resolvers`. |
| `@hookform/resolvers` | `^5.x` | Bridge between `zod` schemas and `react-hook-form` validation. Install alongside `zod` and `react-hook-form`. |

---

## Utilities

| Package | Intended version | Intended use |
|---|---|---|
| `date-fns` | `^4.x` | Replace `Intl.DateTimeFormat` calls in `lib/formatters.ts` with a more ergonomic and testable date formatting API. |
| `sonner` | `^2.x` | Replace current custom `ToastProvider` with the Sonner toast library. Provides stacking, dismissal, and promise toasts out of the box. |
| `class-variance-authority` | `^0.7.x` | Component variant system (e.g. button sizes/colours). Use when building the shared `<Button>` component. |
| `clsx` + `tailwind-merge` | current | Already installed. Use together for conditional className composition if Tailwind is ever adopted. |

---

## Installation Notes

When installing `@radix-ui` packages, check the exact version required by the
current React version in `package.json` before installing. Radix releases are
tied to React peer dependency ranges.

When installing `@tanstack/react-query`, add the `QueryClientProvider` wrapper
in `app/layout.tsx` and remove any duplicate manual polling (`setInterval`) in
hook files.

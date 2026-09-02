# Food Pantry Architecture Contract

This file governs the entire repository. Treat it as the source of truth for structural decisions until a more specific `AGENTS.md` is added in a subdirectory.

## Current Product Scope

The first version has two surfaces:

- A public inventory experience where visitors immediately see available items and can search them.
- An authenticated staff experience where authorized staff can create, modify, and delete items using conventional controls or AI assistance.

Public visitors can browse and search only. Do not add public accounts, requests, reservations, or other workflows without explicit approval.

## Validated Technology Stack

Use:

- React Router v8 in Framework Mode with TypeScript.
- The Cloudflare Vite plugin and a single Cloudflare Worker deployment.
- Supabase for Postgres data, authentication, Row Level Security (RLS), and realtime inventory updates.
- A provider-neutral, server-only adapter for AI functionality.

Do not introduce Astro as a wrapper around React. Astro is compatible with this stack, but both primary surfaces are interactive, so React Router provides a simpler shared model for routing, server rendering, data loading, mutations, and client state.

Do not replace the validated stack with a plain React SPA, Next.js, or another framework without explicit approval and a documented reason.

## Application Boundaries

### Public inventory

- Server-render the currently available inventory into the initial response for `/`. Visitors must not wait for a browser-side fetch before seeing items.
- Hydrate the public experience after the initial render and subscribe to authorized Supabase Realtime events so open pages reflect item inserts, updates, and deletes.
- Search and filter the loaded public collection in the browser. The initial target is fewer than 500 items.
- Keep public code independent from staff-only and AI-only modules. Public routes must not download staff dashboard or AI implementation bundles.
- Expose only records and fields permitted by the eventual public-inventory policy. Do not invent that policy.

### Staff workspace

- Place staff functionality in a lazy-loaded route group separate from public route bundles.
- Use Supabase cookie-based sessions with server-side identity verification before rendering or executing staff functionality.
- Support `editor` and `admin` authorization roles. Enforce their permissions in Supabase grants and RLS policies, not only in route guards or interface visibility.
- Provide ordinary CRUD controls even when AI assistance is available.
- Treat route protection as defense in depth and user experience, never as the authorization boundary.

### Data access

- Use React Router server loaders for initial server-rendered reads and server actions for protected mutations.
- Keep browser and server Supabase clients separate. Never serialize server credentials into route data, props, scripts, or client bundles.
- Execute normal staff operations with the authenticated staff member's identity so RLS remains authoritative.
- Do not use a Supabase secret or service-role key for routine inventory operations. Never expose such a key to the browser.
- Do not cache authenticated responses or responses that set or refresh authentication cookies in shared caches.

## Conceptual Interfaces

These contracts describe responsibilities, not final symbol names or domain fields.

### Public inventory loader

- Runs on the server for the public inventory route.
- Returns only the inventory records the anonymous visitor is authorized to read.
- Supplies the initial collection used by the rendered list and hydrated search experience.
- Must preserve a useful public error state without exposing internal database details.

### Realtime inventory subscription

- Starts only in the browser after hydration.
- Receives only changes authorized for the public inventory surface.
- Reconciles insert, update, and delete events into the loaded collection without requiring a reload.
- Cleans up subscriptions when the route unmounts or reconnects.

### AI provider adapter

- Runs only on the server and owns all provider-specific SDK calls and credentials.
- Accepts an authenticated staff instruction plus the minimum authorized context required to interpret it.
- Produces typed proposals only; it cannot execute SQL, call the database directly, or receive database credentials.
- Keeps provider and model selection replaceable until explicitly decided.

### AI change proposal

Represent AI output as a schema-validated discriminated union with one of these operations:

- `create`
- `update`
- `delete`

The operation-specific item payload remains undefined until the inventory schema is approved. Do not invent fields merely to complete the union.

### Confirmed mutation action

- Accepts only a proposal that a staff member has reviewed and explicitly confirmed.
- Revalidates the authenticated identity, role, proposal schema, target record, current record state, and all applicable business rules.
- Applies the change deterministically through a caller-scoped Supabase client.
- Rejects unauthorized, malformed, stale, or otherwise invalid proposals without partial execution.
- Returns a typed success or safe error result that allows the staff interface to reconcile or reload authoritative data.

## AI Safety Invariants

- AI always follows `instruction -> typed proposal -> staff preview -> explicit confirmation -> deterministic server execution`.
- AI output is untrusted input. Schema-validate it and apply the same authorization and business validation used for manual edits.
- Never let a model autonomously invoke inventory mutations, arbitrary tools, SQL, or privileged database clients.
- Keep model credentials in Cloudflare server-side secrets.
- Do not send more inventory or staff data to a model than the approved task requires.
- Do not silently retry a mutation in a way that could duplicate or repeat a change.

## Security Invariants

- Supabase RLS and database grants are the authoritative access-control layer.
- Anonymous access is read-only and limited to the future explicitly approved public inventory surface.
- Authenticated status alone is insufficient for writes; verify an authorized `editor` or `admin` role.
- Do not base authorization on user-editable profile metadata.
- Validate all mutation input on the server, regardless of client-side validation.
- Never disclose internal errors, secrets, model credentials, session tokens, or privileged database details to public clients.

## Deferred Decisions

The following are intentionally unresolved. Before implementing work that depends on any of them, ask the user and record the confirmed decision in the appropriate architecture or product documentation:

- Inventory fields, categories, quantities, validation, and availability rules.
- Whether the pantry has one location or multiple locations.
- Which inventory fields are public and whether exact quantities are visible.
- Search fields, ranking, filters, and typo-tolerance behavior.
- AI provider and model.
- AI prompt and response logging policy.
- Permanent deletion versus reversible archival.
- Audit history, undo behavior, and retention requirements.
- Concurrent-editing and stale-write behavior beyond rejecting invalid current state.
- Staff invitation, account-management, and role-revocation workflows.
- Visual design, CSS background, component system, typography, color, and motion.

Do not fill these gaps with plausible defaults. Keep dependent implementations blocked or narrowly abstracted until the user decides.

## Acceptance Criteria for Future Implementation

- The initial public HTML contains authorized inventory items without waiting for a client fetch.
- Search updates immediately against the loaded collection.
- Authorized realtime inserts, updates, and deletes update an open public view.
- Unauthenticated visitors cannot access staff functionality or mutate inventory.
- Editors and admins can perform only operations allowed by their eventual RLS policies.
- Staff can complete all supported CRUD operations without AI.
- AI cannot change inventory until a staff member previews and confirms a typed proposal.
- Unauthorized, malformed, stale, and invalid proposals fail safely without partial changes.
- Public route bundles exclude staff-only and AI-only implementation code.
- No secret or service-role credential appears in browser-delivered assets or data.

## Current Confirmed Defaults

- Public v1 scope: browse and search only.
- Initial inventory scale: fewer than 500 items.
- Freshness: automatically update an open public inventory view.
- Staff authorization roles: `editor` and `admin`.
- AI authority: propose changes only; every mutation requires preview and explicit confirmation.
- AI integration: provider-neutral until separately selected.

## Framework References

- [Cloudflare React Router framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
- [React Router data loading](https://reactrouter.com/start/framework/data-loading)
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

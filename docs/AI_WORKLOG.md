# AI Worklog: Mailbox Order Manager Development

This worklog records the development process with the AI coding assistant (Claude Code CLI / Antigravity Agent), detailing the planning methodology, steering prompts, AI errors encountered and their manual/prompted fixes, manual interventions, and time management per phase.

---

## 1. Planning Approach

The project was executed using an iterative, layered architecture methodology across 5 defined phases:
1. **Foundation & Scaffolding**: Setup strict TypeScript, Docker Compose for PostgreSQL, Prisma schema, Vitest, and layered directory structure.
2. **Database & Authentication**: Schema migrations, repeatable seed script with 3 seeded roles, password hashing with `bcryptjs`, session cookies with `jose`, and RBAC helpers.
3. **Core Business Logic & State Machine**: Pure domain `OrderStateMachine`, atomic Prisma transactions, customer-scoped idempotency verification, and unit/integration tests.
4. **Provider Abstraction & Background Worker**: Strategy pattern for Google Workspace and Microsoft 365, safe concurrency via PostgreSQL `FOR UPDATE SKIP LOCKED`, and failure recovery.
5. **Presentation Layer & API Routes**: Next.js App Router API endpoints, customer dashboard, admin console with filtering/pagination/retry, and documentation.

---

## 2. Key Steering Prompts Used

### Prompt 1: Project Architecture and Foundation Setup
> *"We are building the Mailbox Order Manager technical assessment. Stack: Next.js App Router, TypeScript (strict mode), PostgreSQL, Prisma ORM, Zod, Tailwind CSS, Vitest. First analyze the requirements and propose a minimal architecture... Implement the foundation: dependencies, Prisma, docker-compose.yml with persistent storage and health checks, .env.example, TypeScript strict mode, folder structure, Vitest, and CLAUDE.md."*

### Prompt 2: Database and Authentication Layer
> *"Implement the database and authentication layers. Prisma models: User, Order, Mailbox, AuditLog with relations and indexes. Generate Prisma migrations and repeatable seed script (1 admin, 2 customers) with secure password hashing. Implement email/password login, secure session auth with HTTP-only cookies, logout, and current-user retrieval. Keep business logic in services and database operations in repositories."*

### Prompt 3: Core Business Logic and State Machine
> *"Implement the core order management business logic. Order creation: domain, provider (GOOGLE/MICROSOFT), mailbox count (1-50) with Zod validation. Implement idempotency using Idempotency-Key header scoped to authenticated customer. State machine: PENDING -> PROVISIONING -> ACTIVE or FAILED, and FAILED -> PENDING (admin retry only). Reject invalid transitions. Audit logging: atomic state transition and audit recording using Prisma transactions. Create requested mailbox records on order creation."*

### Prompt 4: Provider Abstraction and Provisioning Worker
> *"Implement the mailbox provisioning system. Provider abstraction: MailboxProvider interface, GoogleProvider, MicrosoftProvider (mocked, delay of a few seconds, ~20% random failure). Strategy pattern: select provider using order's provider field. Background worker: independently executable worker using PostgreSQL FOR UPDATE SKIP LOCKED to prevent duplicate processing. Reset failed mailboxes on admin retry."*

### Prompt 5: Complete Frontend Dashboards
> *"Implement the complete frontend using Next.js App Router and Tailwind CSS. Login with validation and role-based redirection. Customer dashboard with order list, metrics, and create order modal preserving idempotency key on failure. Order details with individual mailbox statuses, error callouts, and audit trail. Admin dashboard with filters, pagination, and retry button for FAILED orders only."*

---

## 3. Genuine AI Mistakes & How They Were Resolved

### Mistake 1: Syntax Error in Repository Selection Literals
- **What happened:** When generating `src/server/repositories/order.repository.ts`, the AI generated TypeScript interface-style semicolons inside JavaScript/Prisma object literal selections:
  ```typescript
  customer: {
    select: {
      id: true;
      name: true;
      email: true;
      role: true;
    }
  }
  ```
- **Error message:** `ERROR: Expected "}" but found ";"` during esbuild / Vitest compilation.
- **How it was fixed:** Manually identified all 5 occurrences across `order.repository.ts` and replaced the semicolons with commas (`id: true, name: true, ...`).

### Mistake 2: Calling Next.js `cookies()` Outside Request Scope During Direct Route Testing
- **What happened:** In `src/server/auth/session.ts`, session cookies were read and written solely via Next.js `cookies()` from `next/headers`. When API route handlers were executed directly inside Vitest integration tests without an active Next.js HTTP server wrapper, Next.js threw an unhandled server exception.
- **Error message:** `Unhandled server error: Error: 'cookies' was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`.
- **How it was fixed:** Refactored `src/server/auth/session.ts` and route handlers:
  - Allowed `req?: NextRequest` parameter in auth helpers to read cookies directly from incoming request headers (`req.cookies.get()` and raw `Cookie` header fallback).
  - Used `response.cookies.set()` directly on `NextResponse` for setting and clearing cookies in Route Handlers.
  - Wrapped `cookies()` in try/catch for graceful fallback in server actions.

### Mistake 3: Concurrent Vitest Test Execution Interfering with PostgreSQL Queue
- **What happened:** By default, Vitest executes test suites in parallel worker threads. Both `order.integration.test.ts` and `worker.integration.test.ts` were writing to and deleting from the same live PostgreSQL database concurrently. As a result, worker concurrency tests claimed orders created by parallel test suites, causing assertion mismatches (`expected 1 claimed order, received 2`).
- **Error message:** `AssertionError: expected 2 to be 1` in `worker.integration.test.ts`.
- **How it was fixed:** Updated `vitest.config.ts` to set `fileParallelism: false`, guaranteeing that database integration tests run sequentially in isolation. Also added explicit `prisma.order.deleteMany()` teardowns in `beforeEach` hooks.

---

## 4. Manual Interventions & Refinements

1. **Idempotency Compound Unique Constraint**:
   - Manually updated the Prisma schema from a global `@unique` on `idempotencyKey` to a compound unique index `@@unique([customerId, idempotencyKey])`.
   - This ensures that two separate customers can generate standard UUIDs or sequential keys without colliding with each other.
2. **Docker Compose Version Attribute Warning**:
   - Removed obsolete `version: '3.8'` from `docker-compose.yml` to eliminate Docker Compose v2+ CLI deprecation warnings.
3. **Strict TypeScript Cleanliness**:
   - Cleaned up unused imports across test files and components to satisfy `noUnusedLocals` and `noUnusedParameters` under strict compiler flags.

---

## 5. Time per Phase & Total Time

| Phase | Description | Time Spent |
| :--- | :--- | :--- |
| **Phase 1** | Foundation, Docker Compose, Vitest, Dependencies | 25 mins |
| **Phase 2** | Database, Prisma Migrations, Seed Script, Auth & RBAC | 35 mins |
| **Phase 3** | Domain State Machine, Idempotency, Order Service & Repo | 45 mins |
| **Phase 4** | Provider Abstraction (Strategy Pattern), Safe Worker | 40 mins |
| **Phase 5** | Next.js API Routes, Customer & Admin Dashboards | 45 mins |
| **Phase 6** | End-to-End Testing, Bug Fixes & Documentation | 30 mins |
| **Total** | **Complete Full-Stack Application** | **~3 hours 40 mins** |


# Architecture & Design Patterns: Mailbox Order Manager

This document details the architectural design patterns implemented in the **Mailbox Order Manager**, specifying where each pattern lives, why it was chosen, and the architectural alternatives that were evaluated and rejected.

---

## 1. Strategy Pattern

### Location
- [`src/core/providers/mailbox-provider.interface.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/providers/mailbox-provider.interface.ts)
- [`src/core/providers/google-provider.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/providers/google-provider.ts)
- [`src/core/providers/microsoft-provider.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/providers/microsoft-provider.ts)
- [`src/core/providers/provider-factory.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/providers/provider-factory.ts)

### Why It Was Chosen
Provisioning mailboxes differs fundamentally between providers: Google Workspace uses Google Admin Directory APIs, while Microsoft 365 utilizes Microsoft Graph API. The Strategy Pattern establishes a common interface (`IMailboxProvider`) returning structured results (`ProvisionMailboxResult`). The background worker delegates to the strategy resolved dynamically by the factory (`getMailboxProvider(order.provider)`). This enables adding new providers (e.g. Fastmail, Zoho) with zero changes to the worker.

### Rejected Alternative: Conditional Branching (`switch / case`) in Worker
- **What it is:** Inlining `if (order.provider === 'GOOGLE') { ... } else if (order.provider === 'MICROSOFT') { ... }` directly inside the worker loop.
- **Why rejected:** Violates the Open/Closed Principle (OCP). Mixing provider API integration details with job scheduling and database transaction logic bloats the worker and makes unit testing individual provider failure simulations difficult.

---

## 2. State Machine Pattern

### Location
- [`src/core/state-machine/order-state-machine.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/state-machine/order-state-machine.ts)
- [`src/core/state-machine/index.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/core/state-machine/index.ts)

### Why It Was Chosen
An order follows an explicit, rigorous lifecycle:
```
[INITIAL] ──> PENDING ──> PROVISIONING ──┬──> ACTIVE (Terminal)
                                         └──> FAILED ──(Admin Retry)──> PENDING
```
The `OrderStateMachine` encapsulates transition validity and role guards in a pure, framework-agnostic domain class. It guarantees that:
1. Terminal states (`ACTIVE`) can never transition backwards.
2. Orders cannot skip intermediate states (`PENDING -> ACTIVE` is strictly rejected).
3. `FAILED -> PENDING` requires the caller to possess the `ADMIN` role.

### Rejected Alternative: Ad-hoc Status Updates
- **What it is:** Directly updating `order.status = newStatus` throughout various service methods or route handlers without a centralized transition table.
- **Why rejected:** Highly prone to race conditions and bugs where invalid transitions go unchecked. It scatters business invariants across the codebase and makes it impossible to guarantee that an audit log is emitted for every transition.

---

## 3. Repository Pattern

### Location
- [`src/server/repositories/order.repository.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/repositories/order.repository.ts)
- [`src/server/repositories/user.repository.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/repositories/user.repository.ts)
- [`src/server/repositories/audit-log.repository.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/repositories/audit-log.repository.ts)

### Why It Was Chosen
The Repository Pattern mediates between the domain/application layer and PostgreSQL. It encapsulates complex Prisma relational queries, raw SQL locking queries (`FOR UPDATE SKIP LOCKED`), and multi-statement interactive transactions. Crucially, `UserRepository` strips sensitive credentials, returning `SafeUser` objects to ensure password hashes never leak into the application layer.

### Rejected Alternative: Direct ORM Access in Route Handlers & Components
- **What it is:** Calling `prisma.order.findMany()` or `prisma.order.update()` directly inside Next.js route handlers or React Server Components.
- **Why rejected:** Leaks database schema concerns into the presentation layer, prevents atomic reuse of transaction logic, and makes mocking or substituting persistence impossible during unit testing.

---

## 4. Service Layer Pattern

### Location
- [`src/server/services/order.service.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/services/order.service.ts)
- [`src/server/services/auth.service.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/services/auth.service.ts)

### Why It Was Chosen
The Service Layer acts as the operational facade for business use cases. It orchestrates Zod validation, enforces customer tenant isolation (`assertCustomerOwnsOrder`), coordinates the `OrderStateMachine`, handles idempotency payload verification, and maps domain exceptions to standardized application outcomes. Route handlers simply deserialize HTTP inputs, pass them to services, and serialize JSON responses.

### Rejected Alternative: Fat Route Handlers ("Smart Controllers")
- **What it is:** Writing validation, business orchestration, authorization checks, and error formatting inside Next.js `export async function POST()` route files.
- **Why rejected:** Produces monolithic, untestable route files with duplicate authorization checks. In Next.js App Router, combining business logic with route handlers also prevents reusing use cases in background scripts or CLI workers.

---

## 5. Queue & Worker Pattern (PostgreSQL Database as a Queue)

### Location
- [`src/server/worker/provisioning-worker.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/worker/provisioning-worker.ts)
- [`src/server/worker/index.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/worker/index.ts)
- [`src/server/repositories/order.repository.ts`](file:///C:/Users/PC/.gemini/antigravity/scratch/mailbox-order-manager/src/server/repositories/order.repository.ts) (`claimNextPendingOrder`)

### Why It Was Chosen
Provisioning dozens of mailboxes requires calling third-party provider APIs with latency (simulated as 1–2 seconds per mailbox). Running this synchronously within an HTTP request would exceed browser timeout limits and degrade user experience. The Queue & Worker pattern decouples order submission (instant HTTP 201) from fulfillment.

Concurrency safety is guaranteed natively by PostgreSQL using row-level locking:
```sql
SELECT id FROM "orders"
WHERE status = 'PENDING'::"OrderStatus"
ORDER BY "createdAt" ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```
When multiple worker processes run concurrently, PostgreSQL grants an exclusive lock on row 1 to Worker A. Worker B immediately skips row 1 without blocking and either claims row 2 or sleeps.

### Rejected Alternative: External Message Broker (Redis + BullMQ)
- **What it is:** Introducing Redis and BullMQ / Celery to handle queue management.
- **Why rejected:** Unnecessary infrastructure overhead for this application. PostgreSQL `SKIP LOCKED` delivers ACID-compliant, durable queueing with zero extra daemon dependencies, zero network serialization drift between database and queue, and exact atomic status transitions.

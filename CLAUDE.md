# Mailbox Order Manager - Developer & Agent Guide (CLAUDE.md)

## 1. Project Overview & Architecture
This project is an internal management tool for selling and provisioning pre-warmed Google and Microsoft mailboxes.

### Core Stack
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript (Strict Mode enabled)
- **Database:** PostgreSQL (running via Docker Compose)
- **ORM:** Prisma ORM
- **Validation:** Zod
- **Styling:** Tailwind CSS
- **Testing:** Vitest

---

## 2. Architectural Rules (Non-Negotiable)

1. **Layered Architecture**:
   - **Presentation Layer (`src/app/`, `src/components/`)**:
     - Route handlers (`src/app/api/...`) and React components MUST NOT contain business logic or direct database queries.
     - Route handlers only parse request parameters, validate schemas with Zod, call the Service Layer, and serialize standardized responses.
   - **Service Layer (`src/server/services/`)**:
     - Orchestrates business use cases, coordinates repository operations, invokes the State Machine, and publishes audit logs.
   - **Domain / State Machine Layer (`src/core/`)**:
     - Pure business rules, state machine transitions, domain error definitions, and provider strategy interfaces.
   - **Data Access Layer (`src/server/repositories/`)**:
     - Encapsulates all Prisma database queries and raw SQL transactions.
   - **Background Worker (`src/server/worker/`)**:
     - Independent asynchronous job processor that claims and provisions orders safely without race conditions.

2. **Design Patterns**:
   - **Strategy Pattern (`src/core/providers/`)**: `IMailboxProviderStrategy` implemented by `GoogleMailboxProvider` and `MicrosoftMailboxProvider`.
   - **State Machine Pattern (`src/core/state-machine/`)**: Pure state transitions (`PENDING -> PROVISIONING -> ACTIVE | FAILED` and `FAILED -> PENDING`). Rejects invalid transitions strictly.
   - **Repository Pattern (`src/server/repositories/`)**: Explicit repositories decoupling persistence from application logic.
   - **Service Layer Pattern (`src/server/services/`)**: Business logic facade for use cases.
   - **Queue & Worker Pattern (`src/server/worker/`)**: PostgreSQL-backed job processing with `FOR UPDATE SKIP LOCKED` concurrency protection.

3. **Concurrency & Worker Safety**:
   - Running multiple worker instances concurrently must NEVER process the same order twice.
   - Worker queries use row-level locking (`FOR UPDATE SKIP LOCKED`) within transactions to atomically transition `PENDING -> PROVISIONING`.

4. **Idempotency**:
   - Order creation enforces an `idempotencyKey` unique constraint. Re-submitting the same key returns the existing order safely without duplicate creations.

5. **Strict TypeScript & Error Handling**:
   - No `any`. Strict null checks.
   - Domain errors inherit from `DomainError` (`ValidationError`, `InvalidStateTransitionError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`).
   - Unified API error response format: `{ success: false, error: { code: string, message: string, details?: unknown } }`.

---

## 3. Development Commands

### Environment & Database
```bash
# Start PostgreSQL container
docker compose up -d

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with users and initial data
npm run prisma:seed
```

### Application & Background Worker
```bash
# Run Next.js development server
npm run dev

# Run background worker in separate terminal
npm run worker
```

### Testing & Code Quality
```bash
# Run unit & integration tests
npm test

# Run tests in watch mode
npm run test:watch

# TypeScript type check
npx tsc --noEmit
```

---

## 4. Seeded Accounts & Roles
- **Admin User**: `admin@example.com` (Role: `ADMIN`) - Full visibility, retry failed orders, filter by status and provider.
- **Customer User 1**: `customer1@example.com` (Role: `CUSTOMER`) - View own orders, create orders, view mailbox details and audit log.
- **Customer User 2**: `customer2@example.com` (Role: `CUSTOMER`) - Separate tenant for verifying data isolation.


# Mailbox Order Manager

[![Demo Video Placeholder](https://img.shields.io/badge/Demo_Video-Watch_Walkthrough-blue?style=for-the-badge&logo=youtube)](https://youtu.be/DEMO_VIDEO_PLACEHOLDER)
> **Demo Video Link:** [https://youtu.be/DEMO_VIDEO_PLACEHOLDER](https://youtu.be/DEMO_VIDEO_PLACEHOLDER) *(2 to 3 minute walkthrough demonstrating customer order creation, success & failure flows, admin retry, and test runs)*

---

## 1. Project Overview

**Mailbox Order Manager** is an internal business tool designed for provisioning pre-warmed Google Workspace and Microsoft 365 mailboxes. Built with Next.js App Router (TypeScript strict mode) and PostgreSQL (Prisma ORM), the system enforces strict layered architecture, transactional idempotency, pure domain state machine validation, and concurrent background worker execution backed by PostgreSQL row-locking.

### Core Architecture Highlights
- **Layered Architecture**: Route handlers and React components contain zero business logic. All business rules are isolated in the Service Layer, State Machine, and Repositories.
- **Transactional Idempotency**: Order creation requires an `Idempotency-Key` header scoped to the authenticated customer. Concurrent duplicates return the committed record without duplicate mailboxes or audit records.
- **Provider Abstraction (Strategy Pattern)**: Swappable Google and Microsoft providers with simulated latency and failure rates.
- **Safe Background Worker**: Uses PostgreSQL `FOR UPDATE SKIP LOCKED` inside transactions to prevent multiple worker processes from ever double-processing an order.
- **Audit Log Trail**: Every state transition (`PENDING -> PROVISIONING -> ACTIVE | FAILED` and `FAILED -> PENDING`) is atomically persisted.

---

## 2. Seeded Demo Credentials

| Role | Email | Password | Access / Capabilities |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@example.com` | `Password123!` | Global view across all orders, status/provider filters, and 1-click retry on failed orders. |
| **`CUSTOMER`** | `customer1@example.com` | `Password123!` | Primary customer (Acme Corp). Creates orders, views own orders, mailbox statuses, and audit trail. |
| **`CUSTOMER`** | `customer2@example.com` | `Password123!` | Secondary customer (Stark Industries). Proves multi-tenant customer isolation. |

---

## 3. Quick Start (Clean Setup in < 10 Minutes)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x, v20.x, or v22+)
- [Docker](https://www.docker.com/) & Docker Compose
- `npm`

### Step 1: Clone and Configure Environment
```bash
git clone <repo-url>
cd mailbox-order-manager

# Copy environment variables
cp .env.example .env
```

### Step 2: Start PostgreSQL Database via Docker
```bash
docker compose up -d
```
*PostgreSQL container `mailbox_postgres` will start on port `5432` with health checks enabled.*

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Run Database Migrations & Seed Data
```bash
# Run migrations
npm run prisma:migrate

# Seed demo users (Admin & Customers)
npm run prisma:seed
```

### Step 5: Start the Web Application & Background Worker

Open two terminal tabs:

**Terminal 1: Start Next.js App**
```bash
npm run dev
```
*Access the application at [http://localhost:3000](http://localhost:3000)*

**Terminal 2: Start Background Provisioning Worker**
```bash
npm run worker
```
*The worker continuously polls for `PENDING` orders, safely locks them, and provisions mailboxes.*

---

## 4. Running Tests

The test suite runs with [Vitest](https://vitest.dev/) and exercises unit tests for the pure state machine, strategy pattern, password hashing, and real PostgreSQL integration tests for idempotency, concurrency, and API routes.

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run TypeScript strict type verification
npx tsc --noEmit
```

---

## 5. Endpoints & API Reference

### Authentication
- `POST /api/auth/login` — Authenticate and receive `HttpOnly` JWT session cookie.
- `POST /api/auth/logout` — Clear session cookie.
- `GET /api/auth/me` — Return sanitized current user.

### Customer Operations
- `POST /api/orders` — Create an order idempotently (Requires `Idempotency-Key` header).
- `GET /api/orders` — List authenticated customer's orders with pagination.
- `GET /api/orders/[id]` — Retrieve order details, per-mailbox statuses, and audit trail.

### Admin Operations
- `GET /api/admin/orders` — Global order listing with `status`, `provider`, and pagination filters.
- `POST /api/admin/orders/[id]/retry` — Transition `FAILED -> PENDING`, resetting failed mailboxes.

---

## 6. Known Limitations & Production Enhancements
- **Mock Mailbox Providers**: Google and Microsoft providers simulate delays and 20% random failure rates in development. In production, these would connect to Google Workspace Admin SDK and Microsoft Graph API via OAuth2 credentials.
- **Worker Scalability**: The current implementation polls PostgreSQL using `FOR UPDATE SKIP LOCKED`. For enterprise scale (millions of jobs/day), a dedicated message queue (e.g. AWS SQS or RabbitMQ) or PostgreSQL `LISTEN/NOTIFY` can eliminate polling latency.
- **Token Invalidation**: Session tokens are stateless signed JWTs in `HttpOnly` cookies. For instant revocation across all devices, a Redis token blacklist or database session table can be introduced.

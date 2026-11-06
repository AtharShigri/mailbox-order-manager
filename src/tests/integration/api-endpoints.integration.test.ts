import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as createOrderHandler, GET as listOrdersHandler } from '@/app/api/orders/route';
import { GET as getOrderHandler } from '@/app/api/orders/[id]/route';
import { GET as adminListOrdersHandler } from '@/app/api/admin/orders/route';
import { POST as adminRetryOrderHandler } from '@/app/api/admin/orders/[id]/retry/route';
import { prisma } from '@/server/db/client';
import { OrderStatus, MailboxStatus } from '@prisma/client';
import { SESSION_COOKIE_NAME } from '@/server/auth/session';

describe('Next.js API Route Endpoints Integration Tests', () => {
  let customer1Cookie: string;
  let customer2Cookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // 1. Login as customer1
    const cust1Req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer1@example.com',
        password: 'Password123!',
      }),
    });
    const cust1Res = await loginHandler(cust1Req);
    expect(cust1Res.status).toBe(200);
    const setCookie1 = cust1Res.headers.get('set-cookie');
    expect(setCookie1).toBeDefined();
    customer1Cookie = setCookie1!.split(';')[0]!;

    // 2. Login as customer2
    const cust2Req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer2@example.com',
        password: 'Password123!',
      }),
    });
    const cust2Res = await loginHandler(cust2Req);
    customer2Cookie = cust2Res.headers.get('set-cookie')!.split(';')[0]!;

    // 3. Login as admin
    const adminReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Password123!',
      }),
    });
    const adminRes = await loginHandler(adminReq);
    adminCookie = adminRes.headers.get('set-cookie')!.split(';')[0]!;
  });

  describe('Authentication Endpoints', () => {
    it('POST /api/auth/login rejects wrong credentials with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'WrongPassword!',
        }),
      });

      const res = await loginHandler(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/auth/me returns authenticated user details', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { Cookie: customer1Cookie },
      });

      const res = await meHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe('customer1@example.com');
      expect(json.data.user.role).toBe('CUSTOMER');
      // Password hash must never be returned
      expect(json.data.user.passwordHash).toBeUndefined();
    });

    it('POST /api/auth/logout clears session cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    });
  });

  describe('Customer Order Endpoints', () => {
    it('POST /api/orders creates order with 201 and supports idempotent replay with 200', async () => {
      const idempotencyKey = `api-test-key-${Date.now()}`;
      const payload = {
        domain: 'api-acme.com',
        provider: 'GOOGLE',
        mailboxCount: 3,
      };

      // 1. Initial creation
      const req1 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify(payload),
      });

      const res1 = await createOrderHandler(req1);
      const json1 = await res1.json();

      expect(res1.status).toBe(201);
      expect(json1.success).toBe(true);
      expect(json1.data.idempotentReplay).toBe(false);
      expect(json1.data.order.domain).toBe('api-acme.com');
      expect(json1.data.order.mailboxes).toHaveLength(3);
      expect(json1.data.order.auditLogs).toHaveLength(1);

      // 2. Idempotent replay with exact same key and payload
      const req2 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify(payload),
      });

      const res2 = await createOrderHandler(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.success).toBe(true);
      expect(json2.data.idempotentReplay).toBe(true);
      expect(json2.data.order.id).toBe(json1.data.order.id);
    });

    it('POST /api/orders returns 409 CONFLICT on idempotency key payload mismatch', async () => {
      const idempotencyKey = `api-mismatch-key-${Date.now()}`;

      // Create initial order
      const req1 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'initial-api.com',
          provider: 'GOOGLE',
          mailboxCount: 2,
        }),
      });
      await createOrderHandler(req1);

      // Same key with different mailboxCount
      const req2 = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'initial-api.com',
          provider: 'GOOGLE',
          mailboxCount: 5,
        }),
      });

      const res2 = await createOrderHandler(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(409);
      expect(json2.success).toBe(false);
      expect(json2.error.code).toBe('CONFLICT');
    });

    it('GET /api/orders enforces tenant isolation (only returns customer1 orders)', async () => {
      // Create order for customer2
      const cust2Req = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `cust2-key-${Date.now()}`,
          Cookie: customer2Cookie,
        },
        body: JSON.stringify({
          domain: 'cust2-domain.com',
          provider: 'MICROSOFT',
          mailboxCount: 2,
        }),
      });
      await createOrderHandler(cust2Req);

      // Customer 1 queries their orders
      const listReq = new NextRequest('http://localhost:3000/api/orders', {
        headers: { Cookie: customer1Cookie },
      });
      const listRes = await listOrdersHandler(listReq);
      const listJson = await listRes.json();

      expect(listRes.status).toBe(200);
      expect(listJson.success).toBe(true);
      // Verify no customer2 orders are present
      for (const order of listJson.data.data) {
        expect(order.customer.email).toBe('customer1@example.com');
      }
    });

    it('GET /api/orders/[id] returns order details with mailboxes and audit logs', async () => {
      // Create order for customer 1
      const createReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `detail-key-${Date.now()}`,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'detail-test.com',
          provider: 'GOOGLE',
          mailboxCount: 2,
        }),
      });
      const createRes = await createOrderHandler(createReq);
      const { order } = (await createRes.json()).data;

      // Fetch order by ID
      const getReq = new NextRequest(`http://localhost:3000/api/orders/${order.id}`, {
        headers: { Cookie: customer1Cookie },
      });
      const getRes = await getOrderHandler(getReq, {
        params: Promise.resolve({ id: order.id }),
      });
      const getJson = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getJson.data.order.id).toBe(order.id);
      expect(getJson.data.order.mailboxes).toHaveLength(2);
      expect(getJson.data.order.auditLogs).toHaveLength(1);
    });

    it('GET /api/orders/[id] blocks customer2 from accessing customer1 order with 403', async () => {
      // Create order for customer 1
      const createReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `isolation-key-${Date.now()}`,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'cust1-private.com',
          provider: 'GOOGLE',
          mailboxCount: 2,
        }),
      });
      const createRes = await createOrderHandler(createReq);
      const { order } = (await createRes.json()).data;

      // Customer 2 tries to access customer 1's order
      const getReq = new NextRequest(`http://localhost:3000/api/orders/${order.id}`, {
        headers: { Cookie: customer2Cookie },
      });
      const getRes = await getOrderHandler(getReq, {
        params: Promise.resolve({ id: order.id }),
      });
      const getJson = await getRes.json();

      expect(getRes.status).toBe(403);
      expect(getJson.success).toBe(false);
      expect(getJson.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Admin Endpoints', () => {
    it('GET /api/admin/orders rejects customer access with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/orders', {
        headers: { Cookie: customer1Cookie },
      });

      const res = await adminListOrdersHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('GET /api/admin/orders allows admin to view all orders and filter by status and provider', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/admin/orders?status=PENDING&provider=GOOGLE&page=1&limit=10',
        { headers: { Cookie: adminCookie } }
      );

      const res = await adminListOrdersHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.pagination).toBeDefined();
      expect(Array.isArray(json.data.data)).toBe(true);
    });

    it('POST /api/admin/orders/[id]/retry allows admin to retry a FAILED order', async () => {
      // 1. Create order
      const createReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `admin-retry-key-${Date.now()}`,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'retry-admin-test.com',
          provider: 'MICROSOFT',
          mailboxCount: 2,
        }),
      });
      const createRes = await createOrderHandler(createReq);
      const { order } = (await createRes.json()).data;

      // 2. Set status to FAILED in DB
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED },
      });
      await prisma.mailbox.updateMany({
        where: { orderId: order.id },
        data: { status: MailboxStatus.FAILED, errorMessage: 'API Error' },
      });

      // 3. Customer tries to retry -> 403 Forbidden
      const custRetryReq = new NextRequest(`http://localhost:3000/api/admin/orders/${order.id}/retry`, {
        method: 'POST',
        headers: { Cookie: customer1Cookie },
      });
      const custRetryRes = await adminRetryOrderHandler(custRetryReq, {
        params: Promise.resolve({ id: order.id }),
      });
      expect(custRetryRes.status).toBe(403);

      // 4. Admin retries -> 200 OK, transitions FAILED -> PENDING
      const adminRetryReq = new NextRequest(`http://localhost:3000/api/admin/orders/${order.id}/retry`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
      });
      const adminRetryRes = await adminRetryOrderHandler(adminRetryReq, {
        params: Promise.resolve({ id: order.id }),
      });
      const adminRetryJson = await adminRetryRes.json();

      expect(adminRetryRes.status).toBe(200);
      expect(adminRetryJson.success).toBe(true);
      expect(adminRetryJson.data.order.status).toBe(OrderStatus.PENDING);
      expect(adminRetryJson.data.order.mailboxes[0].status).toBe(MailboxStatus.PENDING);
      expect(adminRetryJson.data.order.mailboxes[0].errorMessage).toBeNull();
    });

    it('POST /api/admin/orders/[id]/retry rejects retrying an ACTIVE order with 422', async () => {
      // Create order
      const createReq = new NextRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `active-retry-key-${Date.now()}`,
          Cookie: customer1Cookie,
        },
        body: JSON.stringify({
          domain: 'active-retry.com',
          provider: 'GOOGLE',
          mailboxCount: 1,
        }),
      });
      const createRes = await createOrderHandler(createReq);
      const { order } = (await createRes.json()).data;

      // Set status to ACTIVE in DB
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.ACTIVE },
      });

      // Admin attempts retry of ACTIVE order
      const adminRetryReq = new NextRequest(`http://localhost:3000/api/admin/orders/${order.id}/retry`, {
        method: 'POST',
        headers: { Cookie: adminCookie },
      });
      const adminRetryRes = await adminRetryOrderHandler(adminRetryReq, {
        params: Promise.resolve({ id: order.id }),
      });
      const adminRetryJson = await adminRetryRes.json();

      expect(adminRetryRes.status).toBe(422);
      expect(adminRetryJson.success).toBe(false);
      expect(adminRetryJson.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });
});

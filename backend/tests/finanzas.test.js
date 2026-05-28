import test from "node:test";
import assert from "node:assert/strict";

import router from "../routes/finanzas.js";
import { pool } from "../db/connection.js";

const originalQuery = pool.query.bind(pool);
const originalGetConnection = pool.getConnection.bind(pool);

const invokeRouter = ({ method, url, user, body }) =>
  new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: url,
      headers: {},
      user,
      body,
      params: {},
      query: {},
    };

    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.headersSent = true;
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      end() {
        this.headersSent = true;
        resolve({ status: this.statusCode, body: null });
        return this;
      },
    };

    router.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: res.statusCode, body: null });
    });
  });

test("POST /api/finanzas/requisiciones/:id/resolver", async (t) => {
  t.afterEach(() => {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
  });

  await t.test("deniega rol distinto a finanzas", async () => {
    const result = await invokeRouter({
      method: "POST",
      url: "/requisiciones/99/resolver",
      user: { id: 10, role: "compras_admin" },
      body: { action: "aprobar" },
    });

    assert.equal(result.status, 403);
    assert.match(String(result.body?.message || ""), /Finanzas/i);
  });

  await t.test("requiere campos financieros para aprobar", async () => {
    const result = await invokeRouter({
      method: "POST",
      url: "/requisiciones/99/resolver",
      user: { id: 20, role: "finanzas" },
      body: { action: "aprobar", project: "P1", fund: "", strategic_program: "E1" },
    });

    assert.equal(result.status, 400);
    assert.match(String(result.body?.message || ""), /Proyecto, fondo/i);
  });

  await t.test("aprueba requisición en Finanzas y la pasa a status 16", async () => {
    const calls = [];
    const conn = {
      async beginTransaction() {
        calls.push({ op: "begin" });
      },
      async commit() {
        calls.push({ op: "commit" });
      },
      async rollback() {
        calls.push({ op: "rollback" });
      },
      release() {
        calls.push({ op: "release" });
      },
      async query(sql, params = []) {
        const text = String(sql);
        calls.push({ op: "conn.query", sql: text, params });

        if (text.includes("SELECT id, statuses_id, users_id, assigned_operator_id FROM requisition")) {
          return [[{ id: 99, statuses_id: 15, users_id: 501, assigned_operator_id: 40 }]];
        }
        if (text.includes("INSERT INTO requisition_finance_review")) {
          return [{ affectedRows: 1 }];
        }
        if (text.includes("UPDATE requisition SET statuses_id")) {
          return [{ affectedRows: 1 }];
        }
        if (text.includes("INSERT INTO requisition_status_history")) {
          return [{ insertId: 1 }];
        }

        throw new Error(`Query no contemplada: ${text}`);
      },
    };

    pool.getConnection = async () => conn;
    pool.query = async (sql, params = []) => {
      const text = String(sql);
      calls.push({ op: "pool.query", sql: text, params });

      if (text.includes("CREATE TABLE IF NOT EXISTS requisition_status_history")) {
        return [{}];
      }
      if (text.includes("SHOW COLUMNS FROM statuses LIKE 'type'")) {
        return [[]];
      }
      if (text.includes("INSERT INTO statuses")) {
        return [{ affectedRows: 3 }];
      }
      if (text.includes("CREATE TABLE IF NOT EXISTS requisition_finance_review")) {
        return [{}];
      }
      if (text.includes("SHOW COLUMNS FROM requisition_finance_review LIKE")) {
        return [[{ Field: params?.[0] || "mock_column" }]];
      }
      if (text.includes("SELECT id FROM users WHERE role = ?")) {
        return [[{ id: 30 }]];
      }
      if (text.includes("CREATE TABLE IF NOT EXISTS notifications")) {
        return [{}];
      }
      if (text.includes("INSERT INTO notifications")) {
        return [{ insertId: 1 }];
      }

      throw new Error(`Query no contemplada: ${text}`);
    };

    const result = await invokeRouter({
      method: "POST",
      url: "/requisiciones/99/resolver",
      user: { id: 20, role: "finanzas" },
      body: {
        action: "aprobar",
        project: "PROY-1",
        fund: "FONDO-1",
        strategic_program: "PE-1",
        budget_available: true,
      },
    });

    assert.equal(result.status, 200);
    assert.equal(result.body?.statuses_id, 16);
    assert.ok(
      calls.some(
        (call) =>
          call.op === "conn.query" &&
          call.sql.includes("UPDATE requisition SET statuses_id") &&
          call.params[0] === 16
      )
    );
  });
});

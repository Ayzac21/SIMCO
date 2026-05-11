import test from "node:test";
import assert from "node:assert/strict";

import router from "../routes/requisiciones.js";
import { pool } from "../db/connection.js";

const originalQuery = pool.query.bind(pool);

const invokeRouter = ({ method, url, user, body }) =>
  new Promise((resolve, reject) => {
    const req = {
      method,
      url,
      originalUrl: url,
      headers: {},
      user,
      body,
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

const runWithPoolStub = async ({ user, setupStub, body = {} }) => {
  const calls = [];
  const state = { updates: [] };

  pool.query = async (sql, params = []) => {
    calls.push({ sql: String(sql), params });
    return setupStub({ sql: String(sql), params, state });
  };

  try {
    const result = await invokeRouter({
      method: "PATCH",
      url: "/99/enviar",
      user,
      body,
    });
    return { status: result.status, json: result.body || {}, calls, state };
  } finally {
    pool.query = originalQuery;
  }
};

test("PATCH /api/requisiciones/:id/enviar", async (t) => {
  await t.test("deniega rol no autorizado", async () => {
    const { status, json, calls } = await runWithPoolStub({
      user: { id: 10, role: "compras_operador" },
      setupStub: () => {
        throw new Error("No debe consultar DB en este caso");
      },
    });

    assert.equal(status, 403);
    assert.equal(json.ok, false);
    assert.match(String(json.message || ""), /Acceso denegado/i);
    assert.equal(calls.length, 0);
  });

  await t.test("compras_admin envía siempre a Secretaría (status 9)", async () => {
    const { status, json, state } = await runWithPoolStub({
      user: { id: 25, role: "compras_admin" },
      body: { resume_to: 12 },
      setupStub: ({ sql, params, state: s }) => {
        if (sql.includes("SELECT users_id FROM requisition WHERE id = ? LIMIT 1")) {
          return [[{ users_id: 25 }]];
        }
        if (sql.includes("SELECT notes FROM requisition WHERE id = ? AND statuses_id = 7 LIMIT 1")) {
          return [[{ notes: "" }]];
        }
        if (sql.includes("UPDATE requisition")) {
          s.updates.push(params[0]);
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("CREATE TABLE IF NOT EXISTS requisition_status_history")) {
          return [{}];
        }
        if (sql.includes("INSERT INTO requisition_status_history")) {
          return [{ insertId: 1 }];
        }
        if (sql.includes("SELECT TRIM(UPPER(sec_scope.ure)) AS secretaria_ure")) {
          return [[{ secretaria_ure: "3.1.2.7" }]];
        }
        if (sql.includes("SELECT id") && sql.includes("FROM users") && sql.includes("role = 'secretaria'")) {
          return [[{ id: 601 }]];
        }
        if (sql.includes("SELECT id FROM users WHERE role = ?")) {
          return [[{ id: 501 }]];
        }
        if (sql.includes("CREATE TABLE IF NOT EXISTS notifications")) {
          return [{}];
        }
        if (sql.includes("INSERT INTO notifications")) {
          return [{ insertId: 1 }];
        }
        throw new Error(`Query no contemplada: ${sql}`);
      },
    });

    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.statuses_id, 9);
    assert.deepEqual(state.updates, [9]);
  });

  await t.test("secretaría envía siempre a Compras (status 12)", async () => {
    const { status, json, state } = await runWithPoolStub({
      user: { id: 30, role: "secretaria" },
      body: { resume_to: 8 },
      setupStub: ({ sql, params, state: s }) => {
        if (sql.includes("SELECT users_id FROM requisition WHERE id = ? LIMIT 1")) {
          return [[{ users_id: 30 }]];
        }
        if (sql.includes("SELECT notes FROM requisition WHERE id = ? AND statuses_id = 7 LIMIT 1")) {
          return [[{ notes: "AJUSTE_COORDINACION: revisar" }]];
        }
        if (sql.includes("UPDATE requisition")) {
          s.updates.push(params[0]);
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("CREATE TABLE IF NOT EXISTS requisition_status_history")) {
          return [{}];
        }
        if (sql.includes("INSERT INTO requisition_status_history")) {
          return [{ insertId: 1 }];
        }
        if (sql.includes("SELECT id FROM users WHERE role LIKE ?")) {
          return [[{ id: 801 }, { id: 802 }]];
        }
        if (sql.includes("CREATE TABLE IF NOT EXISTS notifications")) {
          return [{}];
        }
        if (sql.includes("INSERT INTO notifications")) {
          return [{ insertId: 1 }];
        }
        throw new Error(`Query no contemplada: ${sql}`);
      },
    });

    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.equal(json.statuses_id, 12);
    assert.deepEqual(state.updates, [12]);
  });
});

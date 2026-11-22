import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApp } from "../backend/src/app.js";
import { readConfig, type Config } from "../backend/src/config.js";
import type { SupabaseClients } from "../backend/src/lib/supabase.js";

const config: Config = {
  NODE_ENV: "test",
  PORT: 3001,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "test-key",
  CORS_ORIGINS: "http://localhost:5173",
};
const userId = "d5481774-286b-4c9d-b5cf-7a3320332d6e";

function fakeClients() {
  const tokens: string[] = [];
  const filters: Array<[string, string]> = [];
  const mutations: unknown[] = [];
  const query = {
    select() {
      return query;
    },
    eq(column: string, value: string) {
      filters.push([column, value]);
      return query;
    },
    update(value: unknown) {
      mutations.push(value);
      return query;
    },
    async single() {
      return { data: { id: userId, display_name: "Ada" }, error: null };
    },
  };
  const clients = {
    auth: {
      auth: {
        async getUser(token: string) {
          return token === "valid-token"
            ? {
                data: { user: { id: userId, email: "ada@example.com" } },
                error: null,
              }
            : { data: { user: null }, error: new Error("Invalid JWT") };
        },
      },
    },
    forUser(token: string) {
      tokens.push(token);
      return {
        from() {
          return query;
        },
      };
    },
  } as unknown as SupabaseClients;
  return { clients, tokens, filters, mutations };
}

async function withApi(
  clients: SupabaseClients,
  run: (url: string) => Promise<void>,
) {
  const server = createApp(config, clients).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await run(url);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("health is public; missing, malformed, spoofed and expired tokens are denied", async () => {
  const { clients, tokens } = fakeClients();
  await withApi(clients, async (url) => {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    for (const authorization of [
      "",
      "Basic abc",
      "Bearer fake.jwt.signature",
      "Bearer expired-token",
      "Bearer valid-token extra",
    ]) {
      const response = await fetch(`${url}/api/me`, {
        headers: { authorization },
      });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.deepEqual(tokens, []);
  });
});

test("profile reads and updates use the verified identity and JWT, and reject owner injection", async () => {
  const { clients, tokens, filters, mutations } = fakeClients();
  await withApi(clients, async (url) => {
    const headers = {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    };
    assert.equal((await fetch(`${url}/api/profile`, { headers })).status, 200);
    assert.equal(
      (
        await fetch(`${url}/api/profile`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ display_name: "Ada", id: "another-user" }),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(`${url}/api/profile`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ display_name: " Ada " }),
        })
      ).status,
      200,
    );
    assert.deepEqual(filters, [
      ["id", userId],
      ["id", userId],
    ]);
    assert.ok(tokens.every((token) => token === "valid-token"));
    assert.deepEqual(mutations, [{ display_name: "Ada" }]);
  });
});

test("malformed JSON returns a safe error and CORS allows only configured origins", async () => {
  const { clients } = fakeClients();
  await withApi(clients, async (url) => {
    const response = await fetch(`${url}/api/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: '{"secret":broken',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid request." });
    assert.equal(
      (
        await fetch(`${url}/api/health`, {
          headers: { origin: "https://untrusted.example" },
        })
      ).headers.get("access-control-allow-origin"),
      null,
    );
    assert.equal(
      (
        await fetch(`${url}/api/health`, {
          headers: { origin: "http://localhost:5173" },
        })
      ).headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
  });
});

test("an unavailable auth verifier never permits access or reveals internals", async () => {
  const { clients } = fakeClients();
  clients.auth = {
    auth: {
      getUser: async () => {
        throw new Error("private connection details");
      },
    },
  } as unknown as SupabaseClient;
  await withApi(clients, async (url) => {
    const response = await fetch(`${url}/api/me`, {
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: "An unexpected server error occurred.",
    });
  });
});

test("configuration rejects placeholders and validation errors never contain secrets", () => {
  assert.throws(
    () =>
      readConfig({
        SUPABASE_URL: "bad-url-secret",
        SUPABASE_ANON_KEY: "private-key",
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes("bad-url-secret"));
      assert.ok(!error.message.includes("private-key"));
      return true;
    },
  );
  assert.throws(
    () =>
      readConfig({
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "your-anon-key",
      }),
    /placeholders/,
  );
});

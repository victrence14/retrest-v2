import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRoute, routes, safeReturnPath } from "../frontend/src/routing";

test("return navigation preserves only same-app protected destinations", () => {
  assert.equal(safeReturnPath("/subscriptions?status=active#list"), "/subscriptions?status=active#list");
  assert.equal(safeReturnPath("/account"), "/account");
  assert.equal(safeReturnPath("https://attacker.example"), routes.shield);
  assert.equal(safeReturnPath("//attacker.example"), routes.shield);
  assert.equal(safeReturnPath("/login"), routes.shield);
  assert.equal(safeReturnPath("/unknown"), routes.shield);
  assert.equal(safeReturnPath("/wallets\\@attacker.example"), routes.shield);
  assert.equal(safeReturnPath(null), routes.shield);
});

test("direct route matching distinguishes protected, public, and unknown paths", () => {
  assert.deepEqual(matchRoute(routes.shield), { kind: "protected", pathname: routes.shield });
  assert.deepEqual(matchRoute(routes.recovery), { kind: "public", pathname: routes.recovery });
  assert.deepEqual(matchRoute("/missing"), { kind: "not-found", pathname: "/missing" });
});

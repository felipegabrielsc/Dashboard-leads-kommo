import assert from "node:assert/strict";
import { kommoGate } from "./gate";

assert.equal(kommoGate("/kommo", "GET", false), "allow");
assert.equal(kommoGate("/kommo/vendas", "GET", false), "allow");
assert.equal(kommoGate("/kommo/vendas/", "GET", false), "allow");
assert.equal(kommoGate("/api/kommo/dashboard", "GET", false), "allow");
assert.equal(kommoGate("/api/kommo/vendas", "GET", false), "allow");
assert.equal(kommoGate("/api/kommo/sync", "GET", false), "allow");

assert.equal(kommoGate("/kommo/configuracoes", "GET", false), "login");
assert.equal(kommoGate("/kommo/importacoes", "GET", false), "login");
assert.equal(kommoGate("/api/kommo/config", "GET", false), "unauthorized");
assert.equal(kommoGate("/api/kommo/sync", "POST", false), "unauthorized");
assert.equal(kommoGate("/api/kommo/v4/preview", "POST", false), "unauthorized");
assert.equal(kommoGate("/api/kommo/dashboard", "POST", false), "unauthorized");

assert.equal(kommoGate("/kommo/configuracoes", "GET", true), "allow");
assert.equal(kommoGate("/", "GET", false), "allow");

console.log("kommo gate ok");

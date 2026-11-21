import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loginCommand } from "../../src/commands/login.js";

const scenarios = [
  { name: "developer token flag", options: { token: "zv_test" } },
  { name: "session token flag", options: { token: "jwt-test" } },
  { name: "developer token prompt", options: { email: "zv_test" } },
  {
    name: "password login",
    options: { email: "test@example.com", password: "test-password" },
  },
];

for (const { name, options } of scenarios) {
  test(`${name} displays the actual credentials file path`, async (t) => {
    const output = [];
    const writes = [];
    t.mock.method(fs, "existsSync", () => false);
    t.mock.method(fs, "mkdirSync", () => {});
    t.mock.method(fs, "chmodSync", () => {});
    t.mock.method(fs, "writeFileSync", (file) => writes.push(file));
    t.mock.method(console, "log", (...args) => output.push(args.join(" ")));
    t.mock.method(globalThis, "fetch", async (_url, init) => {
      const { query } = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          data: query.includes("mutation Login")
            ? { login: { accessToken: "jwt-test" } }
            : { me: { username: "Tester" } },
        }),
      };
    });

    await loginCommand({ ...options, endpoint: "https://zyvop.com/graphql" });

    const configPath = path.join(os.homedir(), ".zyvop", "config.json");
    assert.deepEqual(writes, [configPath]);
    assert.ok(output.join("\n").includes(`Saved credentials to ${configPath}`));
    assert.doesNotMatch(output.join("\n"), /~\/\.zyvop\/config.json/);
  });
}

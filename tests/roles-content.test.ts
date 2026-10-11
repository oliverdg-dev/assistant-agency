import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roleGroups, roles } from "../api/_lib/booking.ts";
import { ROLE_GROUPS } from "../src/content/roles.ts";
import { parseFormDeepLink } from "../src/lib/bookingForm.ts";

describe("roles page content", () => {
  it("describes every role the job request form offers, in the same groups", () => {
    assert.deepEqual(
      ROLE_GROUPS.map((group) => group.category),
      roleGroups.map((group) => group.label),
    );
    for (const group of ROLE_GROUPS) {
      const formGroup = roleGroups.find((g) => g.label === group.category);
      assert.deepEqual(group.roles.map((role) => role.name), [...(formGroup?.roles ?? [])], group.category);
    }
  });

  it("opens the form with the role filled in", () => {
    for (const name of ROLE_GROUPS.flatMap((group) => group.roles.map((role) => role.name))) {
      assert.ok(roles.includes(name), name);
      assert.equal(parseFormDeepLink(`?role=${encodeURIComponent(name)}`).role, name);
    }
  });

  it("gives every role a description, three tasks and tools", () => {
    const ids = new Set<string>();
    for (const group of ROLE_GROUPS) {
      assert.ok(!ids.has(group.id), `duplicate id ${group.id}`);
      ids.add(group.id);
      for (const role of group.roles) {
        assert.ok(role.does.length > 20, role.name);
        assert.equal(role.tasks.length, 3, role.name);
        role.tasks.forEach((task) => assert.ok(task.trim().length > 0, role.name));
        assert.ok(role.tools.length > 0, role.name);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./navigation";

describe("safeInternalPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard?tab=orders#latest", "/dashboard?tab=orders#latest"],
    ["/", "/"]
  ])("menerima jalur internal %s", (input, expected) => {
    expect(safeInternalPath(input)).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "dashboard",
    "//example.com",
    "/\\example.com",
    "/foo\\bar",
    "https://example.com",
    "http://example.com/path"
  ])("menolak tujuan khusus atau lintas asal %s", (input) => {
    expect(safeInternalPath(input)).toBeNull();
  });
});

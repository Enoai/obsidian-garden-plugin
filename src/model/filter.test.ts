import { describe, expect, it } from "vitest";
import { hasIgnoreTag, isPathIgnored } from "./filter";

describe("isPathIgnored", () => {
  it("matches an exact file path", () => {
    expect(isPathIgnored("Notes/todo.md", ["Notes/todo.md"])).toBe(true);
  });

  it("matches anything under a folder, nested included", () => {
    expect(isPathIgnored("Archive/2020/jan.md", ["Archive"])).toBe(true);
    expect(isPathIgnored("Archive/jan.md", ["Archive"])).toBe(true);
  });

  it("does not match a folder that is only a name prefix", () => {
    expect(isPathIgnored("Archived/jan.md", ["Archive"])).toBe(false);
  });

  it("tolerates a trailing slash and blank entries", () => {
    expect(isPathIgnored("Templates/daily.md", ["Templates/", "  ", ""])).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(isPathIgnored("Ideas/spark.md", ["Notes", "Archive"])).toBe(false);
    expect(isPathIgnored("Ideas/spark.md", [])).toBe(false);
  });
});

describe("hasIgnoreTag", () => {
  it("matches the tag case-insensitively", () => {
    expect(hasIgnoreTag(["#Garden-Hide"], "garden-hide")).toBe(true);
    expect(hasIgnoreTag(["#garden-hide"], "Garden-Hide")).toBe(true);
  });

  it("matches nested child tags", () => {
    expect(hasIgnoreTag(["#garden-hide/private"], "garden-hide")).toBe(true);
  });

  it("tolerates a leading '#' in the configured name", () => {
    expect(hasIgnoreTag(["#garden-hide"], "#garden-hide")).toBe(true);
  });

  it("does not match a different or partial tag", () => {
    expect(hasIgnoreTag(["#garden"], "garden-hide")).toBe(false);
    expect(hasIgnoreTag(["#garden-hidden"], "garden-hide")).toBe(false);
  });

  it("is disabled by an empty tag name", () => {
    expect(hasIgnoreTag(["#garden-hide"], "")).toBe(false);
    expect(hasIgnoreTag(["#garden-hide"], "  ")).toBe(false);
  });
});

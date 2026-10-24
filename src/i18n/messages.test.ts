import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import th from "../../messages/th.json";

// Flattens nested messages into { "nav.home": "หน้าแรก", ... }.
function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (typeof value !== "object" || value === null) return {};

  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => ({
      ...acc,
      ...flatten(child, prefix ? `${prefix}.${key}` : key),
    }),
    {},
  );
}

const reference = flatten(th);

describe("message dictionaries", () => {
  it.each([
    ["en", en],
    ["ja", ja],
  ])("%s has exactly the same keys as th", (_, messages) => {
    expect(Object.keys(flatten(messages)).sort()).toEqual(
      Object.keys(reference).sort(),
    );
  });

  it.each([
    ["th", th],
    ["en", en],
    ["ja", ja],
  ])("%s has no empty strings", (_, messages) => {
    const empty = Object.entries(flatten(messages))
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});

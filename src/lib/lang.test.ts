import { describe, expect, it } from "vitest";
import { detectLanguage, isCommentLang } from "./lang";

describe("detectLanguage", () => {
  it.each([
    ["อนิเมะเรื่องนี้สนุกมากเลย", "th"],
    ["This episode was really good", "en"],
    ["今日のエピソードは最高でした", "ja"],
    ["カタカナだけのコメント", "ja"],
  ])("tags %s as %s", (text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
  });

  it("returns other for text without letters in the supported scripts", () => {
    expect(detectLanguage("")).toBe("other");
    expect(detectLanguage("!!! 123 🙂")).toBe("other");
    expect(detectLanguage("안녕하세요")).toBe("other");
  });

  it("picks the dominant script in mixed text", () => {
    expect(detectLanguage("OP นี้เพราะมากจริงๆ ครับ")).toBe("th");
    expect(detectLanguage("ok ok ok 最高")).toBe("en");
  });
});

describe("isCommentLang", () => {
  it("accepts only supported tags", () => {
    expect(isCommentLang("th")).toBe(true);
    expect(isCommentLang("fr")).toBe(false);
    expect(isCommentLang(undefined)).toBe(false);
  });
});

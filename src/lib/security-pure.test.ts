import { describe, expect, it } from "vitest";
import { hashPassword, isLoginBlocked, isPasswordLoginEnabled, verifyPassword } from "./admin-password";
import { SESSION_TTL_MS, signSession, verifySession } from "./admin-session";
import { canEmbedTrailer, isYoutubeVideoId } from "./trailer";
import { auditPage, summarizeIssues } from "./seo-audit";

const SECRET = "x".repeat(40);

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("0000");
    expect(await verifyPassword("0000", stored)).toBe(true);
    expect(await verifyPassword("0001", stored)).toBe(false);
  });

  it("never stores the password as plain text and salts every hash", async () => {
    const first = await hashPassword("0000");
    const second = await hashPassword("0000");
    expect(first).not.toContain("0000");
    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$")).toBe(true);
  });

  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("0000", "plain-text")).toBe(false);
    expect(await verifyPassword("0000", "md5$1$2$3$abc$def")).toBe(false);
  });
});

describe("isPasswordLoginEnabled", () => {
  it("is on in development and off in production unless explicitly allowed", () => {
    expect(isPasswordLoginEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isPasswordLoginEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isPasswordLoginEnabled({ NODE_ENV: "production", ADMIN_PASSWORD_LOGIN: "true" } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

describe("isLoginBlocked", () => {
  it("blocks after five failures in the window", () => {
    expect(isLoginBlocked(4)).toBe(false);
    expect(isLoginBlocked(5)).toBe(true);
  });
});

describe("admin session", () => {
  const now = 1_800_000_000_000;

  it("accepts a fresh, correctly signed session", () => {
    const token = signSession({ username: "admin", issuedAt: now }, SECRET);
    expect(verifySession(token, SECRET, now + 1000)).toEqual({ username: "admin", issuedAt: now });
  });

  it("rejects a session after its lifetime", () => {
    const token = signSession({ username: "admin", issuedAt: now }, SECRET);
    expect(verifySession(token, SECRET, now + SESSION_TTL_MS + 1)).toBeNull();
  });

  it("rejects tampered payloads and the wrong secret", () => {
    const token = signSession({ username: "admin", issuedAt: now }, SECRET);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ username: "root", issuedAt: now })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET, now)).toBeNull();
    expect(verifySession(`${body}.${sig}`, "y".repeat(40), now)).toBeNull();
  });

  it("refuses to sign with a short secret", () => {
    expect(() => signSession({ username: "admin", issuedAt: now }, "short")).toThrow();
  });
});

describe("trailer embed gating", () => {
  it("embeds only from an approved channel that allows trailers", () => {
    expect(canEmbedTrailer({ status: "approved", allowTrailer: true })).toBe(true);
    expect(canEmbedTrailer({ status: "approved", allowTrailer: false })).toBe(false);
    expect(canEmbedTrailer({ status: "pending", allowTrailer: true })).toBe(false);
    expect(canEmbedTrailer({ status: "revoked", allowTrailer: true })).toBe(false);
    expect(canEmbedTrailer(null)).toBe(false);
  });

  it("checks the shape of YouTube video ids", () => {
    expect(isYoutubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isYoutubeVideoId("bad id!")).toBe(false);
  });
});

describe("auditPage", () => {
  const good = `<html><head><title>Sample</title>
    <meta name="description" content="Desc">
    <link rel="canonical" href="https://example.com/th/anime/x">
    <link rel="alternate" hreflang="th" href="a"><link rel="alternate" hreflang="en" href="b"><link rel="alternate" hreflang="ja" href="c">
    <script type="application/ld+json">{}</script></head><body></body></html>`;

  it("passes a complete indexed page", () => {
    const issues = auditPage({
      url: "https://example.com/th/anime/x",
      statusCode: 200,
      html: good,
      expectJsonLd: true,
      expectIndexed: true,
    });
    expect(issues).toEqual([]);
  });

  it("reports the problems it finds", () => {
    const issues = auditPage({
      url: "https://example.com/th/anime/other",
      statusCode: 200,
      html: good.replace("<title>Sample</title>", "").replace('hreflang="ja"', 'hreflang="fr"'),
      expectJsonLd: true,
      expectIndexed: true,
    });
    expect(issues).toEqual(expect.arrayContaining(["missing_title", "canonical_mismatch", "missing_hreflang"]));
  });

  it("flags a page that should be indexed but is noindex", () => {
    const html = good.replace("<head>", '<head><meta name="robots" content="noindex">');
    const issues = auditPage({ url: "https://example.com/th/anime/x", statusCode: 200, html, expectJsonLd: false, expectIndexed: true });
    expect(issues).toContain("noindex_mismatch");
  });

  it("returns only the status issue for an error page", () => {
    expect(auditPage({ url: "u", statusCode: 404, html: "", expectJsonLd: false, expectIndexed: true })).toEqual(["status_not_200"]);
  });

  it("summarizes issues by type", () => {
    const counts = summarizeIssues([{ issues: ["missing_title"] }, { issues: ["missing_title", "missing_jsonld"] }]);
    expect(counts.missing_title).toBe(2);
    expect(counts.missing_jsonld).toBe(1);
  });
});

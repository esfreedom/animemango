import { describe, expect, it } from "vitest";
import { adminHomeUrl, adminSiteOrigin, isAdminHost, resolveAdminRoute } from "./admin-host";

const ADMIN = "https://admin.animehub.test";

describe("resolveAdminRoute", () => {
  it("serves the admin host from the admin pages", () => {
    expect(resolveAdminRoute({ pathname: "/", host: "admin.animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "admin",
      pathname: "/admin-app",
    });
    expect(resolveAdminRoute({ pathname: "/studios", host: "admin.animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "admin",
      pathname: "/admin-app/studios",
    });
  });

  it("does not serve the public site on the admin host", () => {
    const route = resolveAdminRoute({ pathname: "/th/anime/one-piece", host: "admin.animehub.test", adminSiteUrl: ADMIN });
    expect(route).toEqual({ kind: "admin", pathname: "/admin-app/th/anime/one-piece" });
  });

  it("returns 404 for the admin prefix on the public host", () => {
    expect(resolveAdminRoute({ pathname: "/admin-app/studios", host: "animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "not_found",
    });
  });

  it("redirects old public admin links to the admin host", () => {
    expect(resolveAdminRoute({ pathname: "/th/admin/studios", host: "animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "redirect",
      url: "https://admin.animehub.test/studios",
    });
    expect(resolveAdminRoute({ pathname: "/en/admin", host: "animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "redirect",
      url: "https://admin.animehub.test/",
    });
  });

  it("keeps public pages public", () => {
    expect(resolveAdminRoute({ pathname: "/th/schedule", host: "animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "public",
    });
  });

  it("lets the Google callback through on both hosts", () => {
    expect(resolveAdminRoute({ pathname: "/auth/callback", host: "admin.animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "passthrough",
    });
    expect(resolveAdminRoute({ pathname: "/auth/callback", host: "animehub.test", adminSiteUrl: ADMIN })).toEqual({
      kind: "passthrough",
    });
  });

  it("is unreachable when ADMIN_SITE_URL is not set", () => {
    expect(resolveAdminRoute({ pathname: "/", host: "localhost:3000", adminSiteUrl: undefined })).toEqual({
      kind: "public",
    });
    expect(resolveAdminRoute({ pathname: "/th/admin", host: "localhost:3000", adminSiteUrl: undefined })).toEqual({
      kind: "not_found",
    });
  });

  it("compares ports when the admin URL has one", () => {
    const local = "http://admin.localhost:3000";
    expect(resolveAdminRoute({ pathname: "/", host: "admin.localhost:3000", adminSiteUrl: local })).toEqual({
      kind: "admin",
      pathname: "/admin-app",
    });
    expect(resolveAdminRoute({ pathname: "/", host: "admin.localhost:4000", adminSiteUrl: local })).toEqual({
      kind: "public",
    });
  });
});

describe("adminHomeUrl", () => {
  it("returns the admin home, or null when not configured", () => {
    expect(adminHomeUrl(ADMIN)).toBe("https://admin.animehub.test/");
    expect(adminHomeUrl(undefined)).toBeNull();
    expect(adminHomeUrl("not a url")).toBeNull();
  });
});

describe("isAdminHost and adminSiteOrigin", () => {
  it("recognises the admin host only", () => {
    expect(isAdminHost({ host: "admin.animehub.test", adminSiteUrl: ADMIN })).toBe(true);
    expect(isAdminHost({ host: "animehub.test", adminSiteUrl: ADMIN })).toBe(false);
    expect(isAdminHost({ host: null, adminSiteUrl: undefined })).toBe(false);
  });

  it("returns the origin without a trailing slash", () => {
    expect(adminSiteOrigin("https://admin.animehub.test/")).toBe("https://admin.animehub.test");
    expect(adminSiteOrigin(undefined)).toBeNull();
  });
});

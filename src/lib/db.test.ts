// Tests for the database connection settings.
// Run with: npm test

import { describe, expect, it } from "vitest";
import { one, postgresConfig } from "./db";

describe("postgresConfig", () => {
  it("encrypts Supabase connections without the strict certificate check", () => {
    const url = "postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require";
    const config = postgresConfig(url, undefined);
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
    expect(config.connectionString).not.toContain("sslmode");
    expect(config.connectionString).toContain("pooler.supabase.com:6543");
  });

  it("checks the certificate when Supabase's CA certificate is given", () => {
    const url = "postgresql://postgres:pw@db.abc.supabase.co:5432/postgres";
    const config = postgresConfig(url, "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----");
    expect(config.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----" });
  });

  it("leaves other hosts alone", () => {
    const url = "postgresql://user:pw@ep-x.us-east-2.aws.neon.tech/neondb?sslmode=require";
    expect(postgresConfig(url, undefined)).toEqual({ connectionString: url });
  });
});

describe("table lock-down", () => {
  it("switches on row level security for every table", async () => {
    const open = await one<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity",
    );
    const all = await one<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'");
    expect(all?.n).toBeGreaterThan(5);
    expect(open?.n).toBe(0);
  });
});

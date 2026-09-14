import { afterEach, describe, expect, it } from "vitest";
import { smtpFromIsLogin } from "../../server/mail/mailer";

const keys = ["SMTP_FROM", "SMTP_USER"] as const;
const previous: Record<string, string | undefined> = {};

describe("smtpFromIsLogin", () => {
  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  });

  it("rejects the Brevo SMTP login used as From", () => {
    for (const key of keys) {
      previous[key] = process.env[key];
    }
    process.env.SMTP_USER = "9e5951001@smtp-brevo.com";
    process.env.SMTP_FROM = "Pachanga <9e5951001@smtp-brevo.com>";
    expect(smtpFromIsLogin()).toBe(true);
  });

  it("accepts a real mailbox as From", () => {
    for (const key of keys) {
      previous[key] = process.env[key];
    }
    process.env.SMTP_USER = "9e5951001@smtp-brevo.com";
    process.env.SMTP_FROM = "Pachanga <you@example.com>";
    expect(smtpFromIsLogin()).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, insertUserSchema, loginSchema } from "@shared/schema";

describe("auth email normalisation", () => {
  it("lowercases and trims login emails", () => {
    const parsed = loginSchema.parse({
      email: "  GonRoho@Gmail.COM ",
      password: "secret1",
    });
    expect(parsed.email).toBe("gonroho@gmail.com");
  });

  it("lowercases register and forgot-password emails", () => {
    expect(
      insertUserSchema.parse({
        username: "gon",
        email: "GonRoho@Gmail.COM",
        password: "secret1",
      }).email,
    ).toBe("gonroho@gmail.com");
    expect(forgotPasswordSchema.parse({ email: "  A@B.CO " }).email).toBe("a@b.co");
  });
});

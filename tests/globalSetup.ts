import "dotenv/config";

export default async function globalSetup() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-phase1";
  process.env.TEST_SCHEMA = process.env.TEST_SCHEMA || "pachanga_test";

  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }

  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.ADS_ENABLED;
  delete process.env.ADS_TEST;
  delete process.env.ADSENSE_CLIENT;
  delete process.env.ADSENSE_SLOT_OVERVIEW;
  delete process.env.ADSENSE_SLOT_HUB;

  const { ensureTestDatabase } = await import("./helpers/testDb");
  await ensureTestDatabase();
}

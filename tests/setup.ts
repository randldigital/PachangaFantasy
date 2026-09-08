import "dotenv/config";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-phase1";
process.env.TEST_SCHEMA = process.env.TEST_SCHEMA || "pachanga_test";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

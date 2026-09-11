CREATE TABLE IF NOT EXISTS "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
INSERT INTO "plans" ("code", "name") VALUES ('free', 'Free'), ('plus', 'Plus')
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "billing_accounts_subject_type_check" CHECK ("subject_type" IN ('user', 'league', 'club'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "billing_accounts_subject" ON "billing_accounts" ("subject_type","subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"billing_account_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" text NOT NULL DEFAULT 'active',
	"current_period_end" timestamp,
	"provider" text,
	"provider_ref" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_billing_account" ON "subscriptions" ("billing_account_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"billing_account_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"amount_cents" integer NOT NULL DEFAULT 0,
	"currency" text NOT NULL DEFAULT 'eur',
	"status" text NOT NULL DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "billing_accounts" ("subject_type", "subject_id")
SELECT 'league', "id" FROM "leagues"
ON CONFLICT ("subject_type", "subject_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "billing_accounts" ("subject_type", "subject_id")
SELECT 'club', "id" FROM "clubs"
ON CONFLICT ("subject_type", "subject_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "subscriptions" ("billing_account_id", "plan_id", "status")
SELECT ba."id", p."id", 'active'
FROM "billing_accounts" ba
CROSS JOIN "plans" p
WHERE p."code" = 'free'
  AND ba."subject_type" IN ('league', 'club')
  AND NOT EXISTS (
    SELECT 1 FROM "subscriptions" s WHERE s."billing_account_id" = ba."id"
  );

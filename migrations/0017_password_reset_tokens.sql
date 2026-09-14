CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);

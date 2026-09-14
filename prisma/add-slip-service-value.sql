-- Adds SlipServiceValue without touching spa_* tables that Prisma does not model.

CREATE TABLE IF NOT EXISTS "SlipServiceValue" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "enteredBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlipServiceValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SlipServiceValue_date_key" ON "SlipServiceValue"("date");
CREATE INDEX IF NOT EXISTS "SlipServiceValue_date_idx" ON "SlipServiceValue"("date");

ALTER TABLE "SlipServiceValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SlipServiceValue" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SlipServiceValue" FROM anon, authenticated;

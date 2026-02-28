-- CreateEnum
CREATE TYPE "LinkPrecedence" AS ENUM ('primary', 'secondary');

-- CreateTable
CREATE TABLE "contact" (
    "id" SERIAL NOT NULL,
    "phone_number" TEXT,
    "email" TEXT,
    "linked_id" INTEGER,
    "link_precedence" "LinkPrecedence" NOT NULL DEFAULT 'primary',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_email_idx" ON "contact"("email");

-- CreateIndex
CREATE INDEX "contact_phone_number_idx" ON "contact"("phone_number");

-- AddForeignKey
ALTER TABLE "contact" ADD CONSTRAINT "contact_linked_id_fkey" FOREIGN KEY ("linked_id") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

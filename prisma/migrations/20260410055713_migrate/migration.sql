/*
  Warnings:

  - A unique constraint covering the columns `[userId,orgId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_orgId_key" ON "User"("userId", "orgId");

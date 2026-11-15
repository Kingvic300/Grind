-- CreateEnum
CREATE TYPE "Status" AS ENUM ('INTERESTED', 'REGISTERED', 'BUILDING', 'SUBMITTED', 'DONE');

-- CreateEnum
CREATE TYPE "Format" AS ENUM ('ONLINE', 'IN_PERSON', 'HYBRID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailReminders" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "url" TEXT,
    "format" "Format" NOT NULL DEFAULT 'ONLINE',
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "Status" NOT NULL DEFAULT 'INTERESTED',
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "registrationDeadline" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3),
    "projectName" TEXT,
    "projectDescription" TEXT,
    "techStack" TEXT[],
    "teammates" TEXT[],
    "repoUrl" TEXT,
    "demoUrl" TEXT,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "placement" TEXT,
    "prizeName" TEXT,
    "prizeAmount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Hackathon_userId_status_idx" ON "Hackathon"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_hackathonId_kind_key" ON "ReminderLog"("hackathonId", "kind");

-- AddForeignKey
ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderLog" ADD CONSTRAINT "ReminderLog_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

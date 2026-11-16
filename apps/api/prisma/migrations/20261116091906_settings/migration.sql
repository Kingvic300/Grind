-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarColor" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "calendarToken" TEXT,
ADD COLUMN     "defaultSpaceId" TEXT,
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "interestFormat" TEXT,
ADD COLUMN     "interestKind" TEXT NOT NULL DEFAULT 'any',
ADD COLUMN     "interestStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "interestTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "remindRegistration1d" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindSubmission1d" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "remindSubmission3d" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeFormat" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "weekStart" TEXT NOT NULL DEFAULT 'MON',
ADD COLUMN     "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "xUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarToken_key" ON "User"("calendarToken");


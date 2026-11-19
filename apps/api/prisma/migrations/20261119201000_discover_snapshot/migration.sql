-- CreateTable
CREATE TABLE "DiscoverSnapshot" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverSnapshot_pkey" PRIMARY KEY ("id")
);

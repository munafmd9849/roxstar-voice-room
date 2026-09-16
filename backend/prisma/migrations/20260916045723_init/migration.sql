-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "SpinStatus" AS ENUM ('WAITING', 'RUNNING', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "SpinParticipantStatus" AS ENUM ('ACTIVE', 'ELIMINATED', 'WINNER');

-- CreateEnum
CREATE TYPE "SpinEventType" AS ENUM ('SPIN_STARTED', 'USER_ELIMINATED', 'WINNER_ANNOUNCED', 'SPIN_ABORTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedDraft" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spin" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "SpinStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Spin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinParticipant" (
    "id" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SpinParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL,
    "eliminationOrder" INTEGER,
    "eliminatedAt" TIMESTAMP(3),

    CONSTRAINT "SpinParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpinEvent" (
    "id" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "type" "SpinEventType" NOT NULL,
    "userId" TEXT,
    "sequence" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpinEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "Room"("ownerId");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_status_idx" ON "RoomMember"("roomId", "status");

-- CreateIndex
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "Draft_userId_createdAt_idx" ON "Draft"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SharedDraft_roomId_sharedAt_idx" ON "SharedDraft"("roomId", "sharedAt" DESC);

-- CreateIndex
CREATE INDEX "Spin_roomId_status_idx" ON "Spin"("roomId", "status");

-- CreateIndex
CREATE INDEX "Spin_winnerId_idx" ON "Spin"("winnerId");

-- CreateIndex
CREATE INDEX "SpinParticipant_spinId_status_idx" ON "SpinParticipant"("spinId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SpinParticipant_spinId_userId_key" ON "SpinParticipant"("spinId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SpinParticipant_spinId_position_key" ON "SpinParticipant"("spinId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SpinEvent_spinId_sequence_key" ON "SpinEvent"("spinId", "sequence");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDraft" ADD CONSTRAINT "SharedDraft_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDraft" ADD CONSTRAINT "SharedDraft_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Draft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedDraft" ADD CONSTRAINT "SharedDraft_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinParticipant" ADD CONSTRAINT "SpinParticipant_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "Spin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinParticipant" ADD CONSTRAINT "SpinParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinEvent" ADD CONSTRAINT "SpinEvent_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "Spin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpinEvent" ADD CONSTRAINT "SpinEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

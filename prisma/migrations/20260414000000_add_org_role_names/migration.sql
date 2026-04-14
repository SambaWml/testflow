-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "roleNames" TEXT NOT NULL DEFAULT '{"OWNER":"Owner","ADMIN":"Admin","MEMBER":"Membro"}';

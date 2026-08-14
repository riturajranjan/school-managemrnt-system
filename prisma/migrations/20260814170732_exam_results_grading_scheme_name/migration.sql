/*
  Warnings:

  - Added the required column `gradingSchemeName` to the `exam_result_publications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exam_result_publications" ADD COLUMN     "gradingSchemeName" TEXT NOT NULL;

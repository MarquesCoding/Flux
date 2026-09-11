UPDATE "media_item" SET "logoUrl" = replace("logoUrl", '/t/p/w500/', '/t/p/original/') WHERE "logoUrl" LIKE '%/t/p/w500/%';

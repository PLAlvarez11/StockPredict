-- Reversion manual (Prisma no ejecuta migraciones "down").
-- Se pierden la descripcion y las subcategorias; cada producto vuelve a la categoria de su subcategoria.
ALTER TABLE "producto" ADD COLUMN "categoria_id" INTEGER;
UPDATE "producto" p SET "categoria_id" = s."categoria_id" FROM "subcategoria" s WHERE s."id" = p."subcategoria_id";
ALTER TABLE "producto" ALTER COLUMN "categoria_id" SET NOT NULL;
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "idx_producto_categoria" ON "producto"("categoria_id");
ALTER TABLE "producto" DROP COLUMN "subcategoria_id";
ALTER TABLE "producto" DROP COLUMN "descripcion";
DROP TABLE "subcategoria";

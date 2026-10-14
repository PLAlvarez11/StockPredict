-- Subcategorias: nuevo nivel entre categoria y producto

CREATE TABLE "subcategoria" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "icono" VARCHAR(50),
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_subcategoria_usuario_estado" ON "subcategoria"("usuario_id", "estado");
CREATE INDEX "idx_subcategoria_categoria" ON "subcategoria"("categoria_id");

ALTER TABLE "subcategoria" ADD CONSTRAINT "subcategoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subcategoria" ADD CONSTRAINT "subcategoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subcategoria" ADD CONSTRAINT "ck_subcategoria_icono" CHECK ("icono" IS NULL OR "icono" IN (
  't-shirt','paint-brush','handbag-simple','flask','sunglasses','dress','sneaker','watch',
  'diamond','crown-simple','hair-dryer','baby-carriage','gift','heart','tag'
));

CREATE UNIQUE INDEX "uq_subcategoria_nombre_activa" ON "subcategoria" ("categoria_id", lower("nombre")) WHERE "estado";

-- Datos: una subcategoria "General" por categoria, con el icono y el estado de la categoria
INSERT INTO "subcategoria" ("usuario_id", "categoria_id", "nombre", "icono", "estado", "creado_en")
SELECT "usuario_id", "id", 'General', "icono", "estado", "creado_en" FROM "categoria";

-- Producto: subcategoria obligatoria y descripcion opcional
ALTER TABLE "producto" ADD COLUMN "subcategoria_id" INTEGER;
ALTER TABLE "producto" ADD COLUMN "descripcion" VARCHAR(500);

UPDATE "producto" p
SET "subcategoria_id" = s."id"
FROM "subcategoria" s
WHERE s."categoria_id" = p."categoria_id" AND s."nombre" = 'General';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "producto" WHERE "subcategoria_id" IS NULL) THEN
    RAISE EXCEPTION 'Migracion detenida: hay productos sin subcategoria';
  END IF;
END $$;

ALTER TABLE "producto" ALTER COLUMN "subcategoria_id" SET NOT NULL;

CREATE INDEX "idx_producto_subcategoria" ON "producto"("subcategoria_id");
ALTER TABLE "producto" ADD CONSTRAINT "producto_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La categoria del producto ahora se obtiene desde la subcategoria
ALTER TABLE "producto" DROP COLUMN "categoria_id";

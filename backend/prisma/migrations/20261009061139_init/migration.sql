-- CreateEnum
CREATE TYPE "tipo_movimiento" AS ENUM ('compra', 'ajuste');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "fecha_creacion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "icono" VARCHAR(50) NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "tipo" "tipo_movimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_anterior" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_recuperacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "usado_en" TIMESTAMPTZ(6),
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_recuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "idx_categoria_usuario_estado" ON "categoria"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "idx_producto_usuario_estado" ON "producto"("usuario_id", "estado");

-- CreateIndex
CREATE INDEX "idx_producto_categoria" ON "producto"("categoria_id");

-- CreateIndex
CREATE INDEX "idx_venta_producto_fecha" ON "venta"("producto_id", "fecha" DESC);

-- CreateIndex
CREATE INDEX "idx_movimiento_producto_fecha" ON "movimiento_inventario"("producto_id", "fecha" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "token_recuperacion_token_hash_key" ON "token_recuperacion"("token_hash");

-- CreateIndex
CREATE INDEX "idx_token_usuario" ON "token_recuperacion"("usuario_id");

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_recuperacion" ADD CONSTRAINT "token_recuperacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones de integridad adicionales (no modelables en Prisma)
ALTER TABLE "producto" ADD CONSTRAINT "ck_producto_stock" CHECK ("stock" >= 0);
ALTER TABLE "venta" ADD CONSTRAINT "ck_venta_cantidad" CHECK ("cantidad" > 0);
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "ck_movimiento_stock_anterior" CHECK ("stock_anterior" >= 0);
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "ck_movimiento_cantidad" CHECK (
  ("tipo" = 'compra' AND "cantidad" > 0) OR ("tipo" = 'ajuste' AND "cantidad" >= 0)
);
ALTER TABLE "categoria" ADD CONSTRAINT "ck_categoria_icono" CHECK ("icono" IN (
  't-shirt','paint-brush','handbag-simple','flask','sunglasses','dress','sneaker','watch',
  'diamond','crown-simple','hair-dryer','baby-carriage','gift','heart','tag'
));

-- Nombres unicos entre registros activos, sin distinguir mayusculas
CREATE UNIQUE INDEX "uq_categoria_nombre_activa" ON "categoria" ("usuario_id", lower("nombre")) WHERE "estado";
CREATE UNIQUE INDEX "uq_producto_nombre_activo" ON "producto" ("usuario_id", lower("nombre")) WHERE "estado";

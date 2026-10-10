import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { api } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { CLAVE_CATEGORIAS } from '../categorias/hooks';
import type { Producto } from '../productos/api';
import { CLAVE_PRODUCTOS, useProductos } from '../productos/hooks';
import { ProductPicker } from '../productos/ProductPicker';
import { CLAVE_PREDICCION } from '../prediccion/PrediccionPage';

const esquema = z.object({
  productoId: z.string().min(1, 'Elige un producto.'),
  cantidad: z
    .number({ error: 'Ingresa la cantidad vendida.' })
    .int('La cantidad debe ser un número entero.')
    .min(1, 'La cantidad debe ser mayor a cero.')
    .max(1_000_000, 'La cantidad es demasiado grande.'),
});

type Valores = z.infer<typeof esquema>;

const textoUnidades = (n: number) =>
  `${n} ${n === 1 ? 'unidad disponible' : 'unidades disponibles'}`;

function Formulario({ productos }: { productos: Producto[] }) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { productoId: '', cantidad: 1 },
  });

  const productoWatch = useWatch({ control, name: 'productoId' });
  const seleccionado = productos.find((p) => String(p.id) === productoWatch);

  const guardar = useMutation({
    mutationFn: (datos: { productoId: number; cantidad: number }) =>
      api<{ stockActual: number }>('POST', '/ventas', datos),
    onSuccess: async () => {
      await Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
        cliente.invalidateQueries({ queryKey: CLAVE_PREDICCION }),
        cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS }),
      ]);
      navegar('/', { state: { aviso: 'Venta registrada correctamente' } });
    },
    onError: (error) =>
      setErrorGeneral(aplicarErroresServidor(error, setError, ['productoId', 'cantidad'])),
  });

  return (
    <form
      className="page"
      style={{ gap: 18 }}
      noValidate
      onSubmit={handleSubmit((datos) => {
        setErrorGeneral(null);
        const producto = productos.find((p) => String(p.id) === datos.productoId);
        if (producto && datos.cantidad > producto.stock) {
          setError('cantidad', {
            type: 'stock',
            message:
              producto.stock === 0
                ? 'Este producto no tiene unidades disponibles.'
                : `Solo hay ${textoUnidades(producto.stock)}.`,
          });
          return;
        }
        guardar.mutate({ productoId: Number(datos.productoId), cantidad: datos.cantidad });
      })}
    >
      {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
      <ProductPicker
        registro={register('productoId')}
        productos={productos}
        seleccionado={seleccionado}
        error={errors.productoId?.message}
      />
      {seleccionado && (
        <div className="card elev-sm resumen-stock">
          <span>Stock actual</span>
          <strong>{seleccionado.stock} u.</strong>
        </div>
      )}
      <Field
        etiqueta="Cantidad vendida"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        placeholder="1"
        error={errors.cantidad?.message}
        {...register('cantidad', { valueAsNumber: true })}
      />
      <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar venta'}
      </Button>
    </form>
  );
}

export function VentaPage() {
  const productos = useProductos();

  let contenido;
  if (productos.isPending) {
    contenido = <ListSkeleton filas={3} />;
  } else if (productos.isError) {
    contenido = <ErrorState onReintentar={() => void productos.refetch()} />;
  } else if (productos.data.datos.length === 0) {
    contenido = (
      <EmptyState
        icono={<ShoppingBag size={26} weight="bold" />}
        titulo="Primero crea un producto"
        texto="Necesitas al menos un producto para registrar una venta."
        accion={
          <Link to="/productos/nuevo" className="btn btn-primary">
            Crear producto
          </Link>
        }
      />
    );
  } else {
    contenido = <Formulario productos={productos.data.datos} />;
  }

  return (
    <>
      <ScreenHeader titulo="Registrar venta" atras="/" />
      {contenido}
    </>
  );
}

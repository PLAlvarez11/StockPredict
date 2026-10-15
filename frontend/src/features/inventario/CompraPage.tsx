import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAviso } from '../../components/layout/Avisos';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { api } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import type { Producto } from '../productos/api';
import { CLAVE_PRODUCTOS, useProductos } from '../productos/hooks';
import { ProductPicker } from '../productos/ProductPicker';
import { CLAVE_PREDICCION } from '../prediccion/PrediccionPage';

const esquema = z.object({
  productoId: z.string().min(1, 'Elige un producto.'),
  cantidad: z
    .number({ error: 'Ingresa la cantidad comprada.' })
    .int('La cantidad debe ser un número entero.')
    .min(1, 'La cantidad debe ser mayor a cero.')
    .max(1_000_000, 'La cantidad es demasiado grande.'),
});

type Valores = z.infer<typeof esquema>;

function Formulario({ productos }: { productos: Producto[] }) {
  const navegar = useNavigate();
  const avisar = useAviso();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const preseleccion = useSearchParams()[0].get('productoId') ?? '';

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      productoId: productos.some((p) => String(p.id) === preseleccion) ? preseleccion : '',
      cantidad: 1,
    },
  });

  const productoWatch = useWatch({ control, name: 'productoId' });
  const seleccionado = productos.find((p) => String(p.id) === productoWatch);
  const cantidadWatch = useWatch({ control, name: 'cantidad' });
  const cantidad = Number(cantidadWatch);
  const resultante = seleccionado
    ? seleccionado.stock + (Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 0)
    : null;

  const guardar = useMutation({
    mutationFn: (datos: { productoId: number; cantidad: number }) =>
      api<{ stockActual: number }>('POST', '/inventario/compras', datos),
    onSuccess: async () => {
      await Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
        cliente.invalidateQueries({ queryKey: CLAVE_PREDICCION }),
      ]);
      avisar('Compra registrada correctamente');
      navegar('/inventario');
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
      <Field
        etiqueta="Cantidad comprada"
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        placeholder="1"
        error={errors.cantidad?.message}
        {...register('cantidad', { valueAsNumber: true })}
      />
      {resultante !== null && (
        <div className="card elev-sm resumen-stock resumen-tinte">
          <span>Stock resultante</span>
          <strong>{resultante} u.</strong>
        </div>
      )}
      <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}

export function CompraPage() {
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
      <ScreenHeader titulo="Registrar compra" atras="/inventario" />
      {contenido}
    </>
  );
}

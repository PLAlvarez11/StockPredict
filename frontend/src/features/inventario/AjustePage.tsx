import { zodResolver } from '@hookform/resolvers/zod';
import { ShoppingBag } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
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
    .number({ error: 'Ingresa el nuevo stock.' })
    .int('El stock debe ser un número entero.')
    .min(0, 'El stock no puede ser negativo.')
    .max(1_000_000, 'El stock es demasiado grande.'),
});

type Valores = z.infer<typeof esquema>;

interface Pendiente {
  producto: Producto;
  cantidad: number;
}

function Formulario({ productos }: { productos: Producto[] }) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { productoId: '' },
  });

  const productoWatch = useWatch({ control, name: 'productoId' });
  const seleccionado = productos.find((p) => String(p.id) === productoWatch);

  const guardar = useMutation({
    mutationFn: (datos: { productoId: number; cantidad: number }) =>
      api<{ stockActual: number }>('POST', '/inventario/ajustes', datos),
    onSuccess: async () => {
      await Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS }),
        cliente.invalidateQueries({ queryKey: CLAVE_PREDICCION }),
      ]);
      navegar('/inventario', { state: { aviso: 'Stock actualizado correctamente' } });
    },
    onError: (error) => {
      setPendiente(null);
      setErrorGeneral(aplicarErroresServidor(error, setError, ['productoId', 'cantidad']));
    },
  });

  return (
    <>
      <form
        className="page"
        style={{ gap: 18 }}
        noValidate
        onSubmit={handleSubmit((datos) => {
          setErrorGeneral(null);
          const producto = productos.find((p) => String(p.id) === datos.productoId);
          if (!producto) return;
          if (datos.cantidad === producto.stock) {
            setError('cantidad', {
              type: 'igual',
              message: `El stock ya es ${producto.stock} u.`,
            });
            return;
          }
          setPendiente({ producto, cantidad: datos.cantidad });
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
          etiqueta="Nuevo stock"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          ayuda="Reemplaza el stock actual. Úsalo para corregir mercadería dañada, perdida o no entregada."
          error={errors.cantidad?.message}
          {...register('cantidad', { valueAsNumber: true })}
        />
        <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
          Guardar
        </Button>
      </form>

      <Dialog
        abierto={pendiente !== null}
        titulo={`¿Cambiar el stock de «${pendiente?.producto.nombre ?? ''}»?`}
        onCerrar={() => setPendiente(null)}
        acciones={
          <>
            <Button onClick={() => setPendiente(null)}>Cancelar</Button>
            <Button
              variante="primary"
              disabled={guardar.isPending}
              onClick={() =>
                pendiente &&
                guardar.mutate({ productoId: pendiente.producto.id, cantidad: pendiente.cantidad })
              }
            >
              {guardar.isPending ? 'Guardando…' : 'Confirmar ajuste'}
            </Button>
          </>
        }
      >
        Pasará de <strong>{pendiente?.producto.stock} u.</strong> a{' '}
        <strong>{pendiente?.cantidad} u.</strong> Se guardará como ajuste manual.
      </Dialog>
    </>
  );
}

export function AjustePage() {
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
      <ScreenHeader titulo="Ajustar stock" atras="/inventario" />
      {contenido}
    </>
  );
}

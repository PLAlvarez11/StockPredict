import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { SelectField } from '../../components/ui/SelectField';
import { ApiError } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import type { Categoria } from '../categorias/api';
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS, useProducto } from './hooks';

const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre del producto.')
    .max(150, 'El nombre es demasiado largo.'),
  categoriaId: z.string().min(1, 'Elige una categoría.'),
  stockInicial: z
    .number({ error: 'Ingresa el stock inicial.' })
    .int('El stock debe ser un número entero.')
    .min(0, 'El stock no puede ser negativo.')
    .max(1_000_000, 'El stock es demasiado grande.'),
});

type Valores = z.infer<typeof esquema>;

interface FormularioProps {
  existente: Producto | null;
  categorias: Categoria[];
}

function Formulario({ existente, categorias }: FormularioProps) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: existente?.nombre ?? '',
      categoriaId: existente ? String(existente.categoria.id) : '',
      stockInicial: existente?.stock ?? 0,
    },
  });

  const guardar = useMutation({
    mutationFn: (datos: Valores) => {
      const categoriaId = Number(datos.categoriaId);
      return existente
        ? productosApi.editar(existente.id, { nombre: datos.nombre, categoriaId })
        : productosApi.crear({
            nombre: datos.nombre,
            categoriaId,
            stockInicial: datos.stockInicial,
          });
    },
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      navegar('/productos', { state: { aviso: 'Producto guardado' } });
    },
    onError: (error) => {
      const mensaje = aplicarErroresServidor(error, setError, [
        'nombre',
        'categoriaId',
        'stockInicial',
      ]);
      setErrorGeneral(mensaje);
    },
  });

  return (
    <form
      className="page"
      style={{ gap: 16 }}
      noValidate
      onSubmit={handleSubmit((datos) => {
        setErrorGeneral(null);
        guardar.mutate(datos);
      })}
    >
      {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
      <Field
        etiqueta="Nombre del producto"
        placeholder="ej. Blusa floral"
        autoComplete="off"
        error={errors.nombre?.message}
        {...register('nombre')}
      />
      <SelectField
        etiqueta="Categoría"
        error={errors.categoriaId?.message}
        {...register('categoriaId')}
      >
        <option value="">Elige una categoría</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </SelectField>
      {existente ? (
        <Field
          etiqueta="Stock actual"
          value={`${existente.stock} u.`}
          readOnly
          disabled
          ayuda="Para cambiarlo usa Inventario → Ajustar stock."
        />
      ) : (
        <Field
          etiqueta="Stock inicial"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          error={errors.stockInicial?.message}
          {...register('stockInicial', { valueAsNumber: true })}
        />
      )}
      <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}

export function ProductoFormPage() {
  const { id } = useParams();
  const numero = id === undefined ? null : Number(id);
  const categorias = useCategorias();
  const producto = useProducto(numero);
  const titulo = numero === null ? 'Nuevo producto' : 'Editar producto';

  let contenido;
  if (categorias.isPending || (numero !== null && producto.isPending)) {
    contenido = <ListSkeleton filas={3} />;
  } else if (categorias.isError) {
    contenido = <ErrorState onReintentar={() => void categorias.refetch()} />;
  } else if (numero !== null && producto.isError) {
    const noExiste = producto.error instanceof ApiError && producto.error.status === 404;
    contenido = noExiste ? (
      <EmptyState
        icono={<span aria-hidden="true">?</span>}
        titulo="El producto no existe"
        accion={
          <Link to="/productos" className="btn btn-primary">
            Volver a productos
          </Link>
        }
      />
    ) : (
      <ErrorState onReintentar={() => void producto.refetch()} />
    );
  } else if (categorias.data.length === 0) {
    contenido = (
      <EmptyState
        icono={<span aria-hidden="true">+</span>}
        titulo="Primero crea una categoría"
        texto="Cada producto pertenece a una categoría."
        accion={
          <Link to="/categorias/nueva" className="btn btn-primary">
            Crear categoría
          </Link>
        }
      />
    );
  } else {
    contenido = (
      <Formulario
        key={producto.data?.id ?? 'nuevo'}
        existente={numero === null ? null : (producto.data ?? null)}
        categorias={categorias.data}
      />
    );
  }

  return (
    <>
      <ScreenHeader titulo={titulo} atras="/productos" />
      {contenido}
    </>
  );
}

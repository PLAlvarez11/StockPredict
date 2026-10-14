import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { TextAreaField } from '../../components/ui/TextAreaField';
import { ApiError } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import type { Categoria } from '../categorias/api';
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from '../subcategorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS, useProducto } from './hooks';

const MAXIMO_DESCRIPCION = 500;

const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre del producto.')
    .max(150, 'El nombre es demasiado largo.'),
  categoriaId: z.string().min(1, 'Elige una categoría.'),
  subcategoriaId: z.string().min(1, 'Elige una subcategoría.'),
  descripcion: z
    .string()
    .max(MAXIMO_DESCRIPCION, `La descripción no puede pasar de ${MAXIMO_DESCRIPCION} caracteres.`),
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
    setValue,
    control,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: existente?.nombre ?? '',
      categoriaId: existente ? String(existente.categoria.id) : '',
      subcategoriaId: existente ? String(existente.subcategoria.id) : '',
      descripcion: existente?.descripcion ?? '',
      stockInicial: existente?.stock ?? 0,
    },
  });

  const categoriaElegida = useWatch({ control, name: 'categoriaId' });
  const descripcion = useWatch({ control, name: 'descripcion' });
  const categoriaNumero = categoriaElegida === '' ? undefined : Number(categoriaElegida);
  const subcategorias = useSubcategorias(categoriaNumero);
  const opciones = categoriaNumero === undefined ? [] : (subcategorias.data ?? []);

  const guardar = useMutation({
    mutationFn: (datos: Valores) => {
      const subcategoriaId = Number(datos.subcategoriaId);
      const texto = datos.descripcion.trim();
      return existente
        ? productosApi.editar(existente.id, {
            nombre: datos.nombre,
            subcategoriaId,
            descripcion: texto === '' ? null : texto,
          })
        : productosApi.crear({
            nombre: datos.nombre,
            subcategoriaId,
            descripcion: texto === '' ? null : texto,
            stockInicial: datos.stockInicial,
          });
    },
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
      navegar('/productos', { state: { aviso: 'Producto guardado' } });
    },
    onError: (error) => {
      const mensaje = aplicarErroresServidor(error, setError, [
        'nombre',
        'subcategoriaId',
        'descripcion',
        'stockInicial',
      ]);
      setErrorGeneral(mensaje);
    },
  });

  const sinSubcategorias =
    categoriaNumero !== undefined && subcategorias.isSuccess && opciones.length === 0;

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
        {...register('categoriaId', { onChange: () => setValue('subcategoriaId', '') })}
      >
        <option value="">Elige una categoría</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </SelectField>
      <SelectField
        etiqueta="Subcategoría"
        disabled={categoriaNumero === undefined}
        error={errors.subcategoriaId?.message}
        {...register('subcategoriaId')}
      >
        <option value="">
          {categoriaNumero === undefined ? 'Primero elige una categoría' : 'Elige una subcategoría'}
        </option>
        {opciones.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </SelectField>
      {sinSubcategorias && (
        <Notice tipo="error">
          Esta categoría no tiene subcategorías activas.{' '}
          <Link to={`/categorias/${categoriaNumero}/subcategorias/nueva`}>Crear una</Link>
        </Notice>
      )}
      <TextAreaField
        etiqueta="Descripción (opcional)"
        placeholder="ej. Blusa de algodón, manga corta, tallas S a L"
        maxLength={MAXIMO_DESCRIPCION}
        maximo={MAXIMO_DESCRIPCION}
        caracteres={descripcion.length}
        error={errors.descripcion?.message}
        {...register('descripcion')}
      />
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
  } else if (numero !== null && producto.data && !producto.data.estado) {
    contenido = (
      <EmptyState
        icono={<span aria-hidden="true">!</span>}
        titulo="El producto está inactivo"
        texto="Actívalo desde la lista de productos inactivos para poder editarlo."
        accion={
          <Link to="/productos" className="btn btn-primary">
            Volver a productos
          </Link>
        }
      />
    );
  } else if (categorias.data.length === 0) {
    contenido = (
      <EmptyState
        icono={<span aria-hidden="true">+</span>}
        titulo="Primero crea una categoría"
        texto="Cada producto pertenece a una subcategoría dentro de una categoría."
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

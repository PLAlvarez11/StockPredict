import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { IconBadge } from '../../components/ui/IconBadge';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { SelectField } from '../../components/ui/SelectField';
import { Switch } from '../../components/ui/Switch';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { ApiError } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import type { Categoria } from '../categorias/api';
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from '../subcategorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS, useProducto } from './hooks';

const MAXIMO_DESCRIPCION = 500;
const TOTAL_PASOS = 4;

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
  activo: z.boolean(),
  stockInicial: z
    .number({ error: 'Ingresa el stock inicial.' })
    .int('El stock debe ser un número entero.')
    .min(0, 'El stock no puede ser negativo.')
    .max(1_000_000, 'El stock es demasiado grande.'),
});

type Valores = z.infer<typeof esquema>;
type Campo = FieldPath<Valores>;

const CAMPOS_POR_PASO: Record<number, Campo[]> = {
  1: ['nombre', 'categoriaId'],
  2: ['subcategoriaId'],
  3: ['descripcion'],
  4: ['stockInicial'],
};

const TITULOS_PASO: Record<number, string> = {
  1: 'Nombre y categoría',
  2: 'Subcategoría',
  3: 'Descripción y estado',
  4: 'Resumen',
};

const pasoDeCampo = (campo: string) =>
  Number(
    Object.entries(CAMPOS_POR_PASO).find(([, campos]) =>
      (campos as string[]).includes(campo),
    )?.[0] ?? TOTAL_PASOS,
  );

interface FormularioProps {
  existente: Producto | null;
  categorias: Categoria[];
}

function Formulario({ existente, categorias }: FormularioProps) {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [paso, setPaso] = useState(1);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: existente?.nombre ?? '',
      categoriaId: existente ? String(existente.categoria.id) : '',
      subcategoriaId: existente ? String(existente.subcategoria.id) : '',
      descripcion: existente?.descripcion ?? '',
      activo: true,
      stockInicial: existente?.stock ?? 0,
    },
  });

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
  }, [paso]);

  const categoriaElegida = useWatch({ control, name: 'categoriaId' });
  const subcategoriaElegida = useWatch({ control, name: 'subcategoriaId' });
  const nombre = useWatch({ control, name: 'nombre' });
  const descripcion = useWatch({ control, name: 'descripcion' });
  const activo = useWatch({ control, name: 'activo' });
  const categoriaNumero = categoriaElegida === '' ? undefined : Number(categoriaElegida);
  const subcategorias = useSubcategorias(categoriaNumero);
  const opciones = categoriaNumero === undefined ? [] : (subcategorias.data ?? []);
  const categoria = categorias.find((c) => c.id === categoriaNumero);
  const subcategoria = opciones.find((s) => String(s.id) === subcategoriaElegida);

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
            estado: datos.activo,
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
      const campos: Campo[] = ['nombre', 'subcategoriaId', 'descripcion', 'stockInicial'];
      const mensaje = aplicarErroresServidor(error, setError, campos);
      setErrorGeneral(mensaje);
      if (error instanceof ApiError) {
        const afectados = error.errors.map((e) => pasoDeCampo(e.field)).filter((n) => n < 4);
        if (afectados.length > 0) setPaso(Math.min(...afectados));
      }
    },
  });

  const avanzar = async () => {
    setErrorGeneral(null);
    if (await trigger(CAMPOS_POR_PASO[paso])) setPaso(paso + 1);
  };

  const alEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (paso < TOTAL_PASOS) {
      void avanzar();
      return;
    }
    setErrorGeneral(null);
    void handleSubmit(async (datos) => {
      guardar.mutate(datos);
    })(e);
  };

  const sinSubcategorias =
    categoriaNumero !== undefined && subcategorias.isSuccess && opciones.length === 0;

  return (
    <form className="page" style={{ gap: 16 }} noValidate onSubmit={alEnviar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="paso-subtitulo">
          Paso {paso} de {TOTAL_PASOS}
        </p>
        <ol className="pasos" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} data-hecho={n <= paso} />
          ))}
        </ol>
        <h2 ref={titulo} tabIndex={-1} className="sr-only">
          {TITULOS_PASO[paso]}
        </h2>
      </div>
      {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}

      {paso === 1 && (
        <>
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
        </>
      )}

      {paso === 2 && (
        <fieldset
          className="opciones"
          aria-describedby={errors.subcategoriaId ? 'sub-error' : undefined}
        >
          <legend>
            Elige la subcategoría de <strong>{nombre.trim()}</strong>.
          </legend>
          {subcategorias.isPending && <ListSkeleton filas={2} />}
          {subcategorias.isError && (
            <ErrorState onReintentar={() => void subcategorias.refetch()} />
          )}
          {opciones.map((s) => (
            <label key={s.id} className="opcion">
              <input type="radio" value={s.id} {...register('subcategoriaId')} />
              <IconBadge icono={s.icono} />
              <span className="list-row-title">{s.nombre}</span>
            </label>
          ))}
          {sinSubcategorias && (
            <Notice tipo="error">
              Esta categoría no tiene subcategorías activas.{' '}
              <Link to={`/categorias/${categoriaNumero}/subcategorias/nueva`}>Crear una</Link>
            </Notice>
          )}
          {errors.subcategoriaId?.message && (
            <p id="sub-error" className="field-error" role="alert">
              {errors.subcategoriaId.message}
            </p>
          )}
        </fieldset>
      )}

      {paso === 3 && (
        <>
          <TextAreaField
            etiqueta="Descripción (opcional)"
            placeholder="ej. Tela ligera, ideal para el día a día"
            maxLength={MAXIMO_DESCRIPCION}
            maximo={MAXIMO_DESCRIPCION}
            caracteres={descripcion.length}
            error={errors.descripcion?.message}
            {...register('descripcion')}
          />
          {!existente && (
            <Switch
              etiqueta="Producto activo"
              ayuda="Si lo apagas, el producto queda guardado pero fuera de las listas, las ventas y la predicción. Podrás activarlo después."
              {...register('activo')}
            />
          )}
        </>
      )}

      {paso === 4 && (
        <>
          <section className="resumen" aria-label="Resumen del producto">
            <div className="resumen-cabecera">
              <IconBadge icono={subcategoria?.icono ?? categoria?.icono ?? 'package'} />
              <div className="list-row-main">
                <div className="list-row-title">{nombre.trim()}</div>
                <div className="list-row-sub">
                  {categoria?.nombre} · {subcategoria?.nombre}
                </div>
              </div>
            </div>
            <p className="resumen-descripcion">
              {descripcion.trim() === '' ? 'Sin descripción' : descripcion.trim()}
            </p>
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
            <div className="resumen-fila">
              <span>Estado</span>
              <span className={existente || activo ? 'tag tag-ok' : 'tag tag-inactivo'}>
                {existente || activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </section>
        </>
      )}

      <div className="acciones-paso">
        {paso > 1 && (
          <Button
            onClick={() => {
              setErrorGeneral(null);
              setPaso(paso - 1);
            }}
          >
            Atrás
          </Button>
        )}
        {paso < TOTAL_PASOS ? (
          <Button type="submit" variante="primary">
            Siguiente
          </Button>
        ) : (
          <Button type="submit" variante="primary" disabled={guardar.isPending}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        )}
      </div>
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

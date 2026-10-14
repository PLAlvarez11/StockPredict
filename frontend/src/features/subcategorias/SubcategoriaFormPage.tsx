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
import { aplicarErroresServidor } from '../../lib/formErrors';
import { ICONOS_CATEGORIA } from '../../lib/iconos';
import { CLAVE_CATEGORIAS, useCategorias } from '../categorias/hooks';
import { IconPicker } from '../categorias/IconPicker';
import { subcategoriasApi, type Subcategoria } from './api';
import { CLAVE_SUBCATEGORIAS, useSubcategorias } from './hooks';

const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre de la subcategoría.')
    .max(100, 'El nombre es demasiado largo.'),
  icono: z.union([z.enum(ICONOS_CATEGORIA), z.literal('')]),
});

type Valores = z.infer<typeof esquema>;

interface FormularioProps {
  categoriaId: number;
  iconoCategoria: string;
  existente: Subcategoria | null;
}

function Formulario({ categoriaId, iconoCategoria, existente }: FormularioProps) {
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
      icono: (existente?.iconoPropio ?? '') as Valores['icono'],
    },
  });

  const guardar = useMutation({
    mutationFn: (datos: Valores) => {
      const icono = datos.icono === '' ? null : datos.icono;
      return existente
        ? subcategoriasApi.editar(existente.id, { nombre: datos.nombre, icono })
        : subcategoriasApi.crear({ categoriaId, nombre: datos.nombre, icono });
    },
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      await cliente.invalidateQueries({ queryKey: ['productos'] });
      navegar('/categorias', { state: { aviso: 'Subcategoría guardada', abrir: categoriaId } });
    },
    onError: (error) =>
      setErrorGeneral(aplicarErroresServidor(error, setError, ['nombre', 'icono', 'categoriaId'])),
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
        etiqueta="Nombre de la subcategoría"
        placeholder="ej. Blusas"
        autoComplete="off"
        error={errors.nombre?.message}
        {...register('nombre')}
      />
      <IconPicker
        registro={register('icono')}
        error={errors.icono?.message}
        titulo="Ícono de la subcategoría"
        ayuda="Aparece junto a cada producto de la subcategoría."
        heredar={{ icono: iconoCategoria, texto: 'Mismo ícono de la categoría' }}
      />
      <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}

export function SubcategoriaFormPage() {
  const { id, subId } = useParams();
  const categoriaId = Number(id);
  const subcategoriaId = subId === undefined ? null : Number(subId);
  const categorias = useCategorias();
  const subcategorias = useSubcategorias(categoriaId);
  const titulo = subcategoriaId === null ? 'Nueva subcategoría' : 'Editar subcategoría';

  let contenido;
  if (categorias.isPending || subcategorias.isPending) {
    contenido = <ListSkeleton filas={2} />;
  } else if (categorias.isError || subcategorias.isError) {
    contenido = (
      <ErrorState
        onReintentar={() => {
          void categorias.refetch();
          void subcategorias.refetch();
        }}
      />
    );
  } else {
    const categoria = categorias.data.find((c) => c.id === categoriaId);
    const existente =
      subcategoriaId === null
        ? null
        : (subcategorias.data.find((s) => s.id === subcategoriaId) ?? null);
    if (!categoria || (subcategoriaId !== null && !existente)) {
      contenido = (
        <EmptyState
          icono={<span aria-hidden="true">?</span>}
          titulo="No se encontró lo que buscabas"
          accion={
            <Link to="/categorias" className="btn btn-primary">
              Volver a categorías
            </Link>
          }
        />
      );
    } else {
      contenido = (
        <Formulario
          key={existente?.id ?? 'nueva'}
          categoriaId={categoriaId}
          iconoCategoria={categoria.icono}
          existente={existente}
        />
      );
    }
  }

  return (
    <>
      <ScreenHeader titulo={titulo} atras="/categorias" />
      {contenido}
    </>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useAviso } from '../../components/layout/Avisos';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { ListSkeleton } from '../../components/ui/ListSkeleton';
import { Notice } from '../../components/ui/Notice';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { ICONOS_CATEGORIA } from '../../lib/iconos';
import { categoriasApi } from './api';
import { CLAVE_CATEGORIAS, useCategorias } from './hooks';
import { IconPicker } from './IconPicker';

const esquema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Ingresa el nombre de la categoría.')
    .max(100, 'El nombre es demasiado largo.'),
  icono: z.enum(ICONOS_CATEGORIA, { error: 'Elige un ícono.' }),
});

type Valores = z.infer<typeof esquema>;

function Formulario({ id, inicial }: { id: number | null; inicial: Partial<Valores> }) {
  const navegar = useNavigate();
  const avisar = useAviso();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: inicial });

  const guardar = useMutation({
    mutationFn: (datos: Valores) =>
      id === null ? categoriasApi.crear(datos) : categoriasApi.editar(id, datos),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
      await cliente.invalidateQueries({ queryKey: ['productos'] });
      avisar('Categoría guardada');
      navegar('/categorias');
    },
    onError: (error) =>
      setErrorGeneral(aplicarErroresServidor(error, setError, ['nombre', 'icono'])),
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
        etiqueta="Nombre de la categoría"
        placeholder="ej. Ropa"
        autoComplete="off"
        error={errors.nombre?.message}
        {...register('nombre')}
      />
      <IconPicker registro={register('icono')} error={errors.icono?.message} />
      <Button type="submit" variante="primary" bloque disabled={guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}

export function CategoriaFormPage() {
  const { id } = useParams();
  const numero = id === undefined ? null : Number(id);
  const categorias = useCategorias();
  const titulo = numero === null ? 'Nueva categoría' : 'Editar categoría';

  let contenido;
  if (numero === null) {
    contenido = <Formulario id={null} inicial={{ nombre: '' }} />;
  } else if (categorias.isPending) {
    contenido = <ListSkeleton filas={2} />;
  } else if (categorias.isError) {
    contenido = <ErrorState onReintentar={() => void categorias.refetch()} />;
  } else {
    const existente = categorias.data.find((c) => c.id === numero);
    contenido = existente ? (
      <Formulario
        key={existente.id}
        id={existente.id}
        inicial={{ nombre: existente.nombre, icono: existente.icono as Valores['icono'] }}
      />
    ) : (
      <EmptyState
        icono={<span aria-hidden="true">?</span>}
        titulo="La categoría no existe"
        accion={
          <Link to="/categorias" className="btn btn-primary">
            Volver a categorías
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ScreenHeader titulo={titulo} atras="/categorias" />
      {contenido}
    </>
  );
}

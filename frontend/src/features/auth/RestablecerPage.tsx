import { zodResolver } from '@hookform/resolvers/zod';
import { CaretLeft, LinkBreak } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { ApiError } from '../../lib/apiClient';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { authApi } from './api';
import { restablecerSchema, type RestablecerForm } from './schemas';

export function RestablecerPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navegar = useNavigate();
  const [vencido, setVencido] = useState(token.length === 0);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RestablecerForm>({ resolver: zodResolver(restablecerSchema) });

  const cambiar = useMutation({
    mutationFn: authApi.restablecer,
    onSuccess: () =>
      navegar('/login', {
        replace: true,
        state: { aviso: 'Contraseña actualizada correctamente' },
      }),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'TOKEN_INVALID') {
        setVencido(true);
        return;
      }
      setErrorGeneral(aplicarErroresServidor(error, setError, ['contrasena']));
    },
  });

  if (vencido) {
    return (
      <div className="auth">
        <EmptyState
          icono={<LinkBreak size={28} weight="bold" />}
          titulo="Enlace inválido o vencido"
          texto="Los enlaces valen 30 minutos y solo se pueden usar una vez. Solicita uno nuevo."
          accion={
            <Link to="/recuperar" className="btn btn-primary">
              Solicitar un enlace nuevo
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="auth">
      <Link to="/login" className="back-link">
        <CaretLeft size={16} aria-hidden="true" />
        Iniciar sesión
      </Link>
      <div className="auth-title">
        <h1>Restablecer contraseña</h1>
        <p>Elige una nueva contraseña para tu cuenta.</p>
      </div>
      <form
        className="auth-form"
        noValidate
        onSubmit={handleSubmit(({ contrasena }) => {
          setErrorGeneral(null);
          cambiar.mutate({ token, contrasena });
        })}
      >
        {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
        <Field
          etiqueta="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          ayuda="Mínimo 8 caracteres."
          error={errors.contrasena?.message}
          {...register('contrasena')}
        />
        <Field
          etiqueta="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          error={errors.confirmar?.message}
          {...register('confirmar')}
        />
        <Button type="submit" variante="primary" bloque disabled={cambiar.isPending}>
          {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </div>
  );
}

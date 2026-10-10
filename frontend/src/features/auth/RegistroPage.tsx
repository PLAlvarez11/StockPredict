import { zodResolver } from '@hookform/resolvers/zod';
import { CaretLeft } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { authApi } from './api';
import { registroSchema, type RegistroForm } from './schemas';
import { CLAVE_SESION } from './useSesion';

export function RegistroPage() {
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegistroForm>({ resolver: zodResolver(registroSchema) });

  const crear = useMutation({
    mutationFn: authApi.registro,
    onSuccess: ({ usuario }) => {
      cliente.setQueryData(CLAVE_SESION, usuario);
      navegar('/', { replace: true });
    },
    onError: (error) =>
      setErrorGeneral(aplicarErroresServidor(error, setError, ['nombre', 'correo', 'contrasena'])),
  });

  return (
    <div className="auth">
      <Link to="/login" className="back-link">
        <CaretLeft size={16} aria-hidden="true" />
        Iniciar sesión
      </Link>
      <div className="auth-title">
        <h1>Crear cuenta</h1>
        <p>Empieza a controlar tu inventario</p>
      </div>
      <form
        className="auth-form"
        noValidate
        onSubmit={handleSubmit(({ nombre, correo, contrasena }) => {
          setErrorGeneral(null);
          crear.mutate({ nombre, correo, contrasena });
        })}
      >
        {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
        <Field
          etiqueta="Nombre completo"
          autoComplete="name"
          placeholder="Tu nombre"
          error={errors.nombre?.message}
          {...register('nombre')}
        />
        <Field
          etiqueta="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          error={errors.correo?.message}
          {...register('correo')}
        />
        <Field
          etiqueta="Contraseña"
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
        <Button type="submit" variante="primary" bloque disabled={crear.isPending}>
          {crear.isPending ? 'Creando cuenta…' : 'Registrarme'}
        </Button>
      </form>
    </div>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkle } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { authApi } from './api';
import { loginSchema, type LoginForm } from './schemas';
import { CLAVE_SESION } from './useSesion';
import { useTitulo } from '../../lib/useTitulo';

interface EstadoLogin {
  desde?: string;
}

export function LoginPage() {
  useTitulo('Iniciar sesión');
  const navegar = useNavigate();
  const cliente = useQueryClient();
  const estado = (useLocation().state ?? {}) as EstadoLogin;
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const entrar = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ usuario }) => {
      cliente.setQueryData(CLAVE_SESION, usuario);
      navegar(estado.desde ?? '/', { replace: true });
    },
    onError: (error) =>
      setErrorGeneral(aplicarErroresServidor(error, setError, ['correo', 'contrasena'])),
  });

  return (
    <div className="auth">
      <div className="auth-center">
        <div className="auth-brand">
          <div className="icon-badge icon-badge-lg" aria-hidden="true">
            <Sparkle size={28} weight="bold" />
          </div>
          <h1>StockPredict</h1>
          <p>Inventario y predicción de compra</p>
        </div>

        <form
          className="auth-form"
          noValidate
          onSubmit={handleSubmit((datos) => {
            setErrorGeneral(null);
            entrar.mutate(datos);
          })}
        >
          {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
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
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.contrasena?.message}
            {...register('contrasena')}
          />
          <Button type="submit" variante="primary" bloque disabled={entrar.isPending}>
            {entrar.isPending ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
          <Link to="/recuperar" style={{ textAlign: 'center', fontSize: 14 }}>
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      </div>
      <p className="auth-footer">
        ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
      </p>
    </div>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { CaretLeft } from '@phosphor-icons/react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { aplicarErroresServidor } from '../../lib/formErrors';
import { authApi } from './api';
import { recuperarSchema, type RecuperarForm } from './schemas';
import { useTitulo } from '../../lib/useTitulo';

export function RecuperarPage() {
  useTitulo('Recuperar contraseña');
  const [enviado, setEnviado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RecuperarForm>({ resolver: zodResolver(recuperarSchema) });

  const solicitar = useMutation({
    mutationFn: authApi.recuperar,
    onSuccess: () => setEnviado(true),
    onError: (error) => setErrorGeneral(aplicarErroresServidor(error, setError, ['correo'])),
  });

  return (
    <div className="auth">
      <Link to="/login" className="back-link">
        <CaretLeft size={16} aria-hidden="true" />
        Iniciar sesión
      </Link>
      <div className="auth-title">
        <h1>Recuperar contraseña</h1>
        <p>Te enviaremos un enlace a tu correo para restablecerla.</p>
      </div>
      <form
        className="auth-form"
        noValidate
        onSubmit={handleSubmit((datos) => {
          setErrorGeneral(null);
          setEnviado(false);
          solicitar.mutate(datos);
        })}
      >
        <Field
          etiqueta="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          error={errors.correo?.message}
          {...register('correo')}
        />
        <Button type="submit" variante="primary" bloque disabled={solicitar.isPending}>
          {solicitar.isPending ? 'Enviando…' : 'Enviar enlace'}
        </Button>
        {errorGeneral && <Notice tipo="error">{errorGeneral}</Notice>}
        {enviado && (
          <Notice>
            Si el correo existe, te enviamos un enlace para restablecer tu contraseña.
          </Notice>
        )}
      </form>
    </div>
  );
}

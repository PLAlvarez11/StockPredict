import { ArrowRight, ShoppingCartSimple, SignOut } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Notice } from '../../components/ui/Notice';
import { authApi } from '../auth/api';
import { CLAVE_SESION, useSesion } from '../auth/useSesion';

export function InicioPage() {
  const { data: usuario } = useSesion();
  const cliente = useQueryClient();
  const aviso = ((useLocation().state ?? {}) as { aviso?: string }).aviso;
  const [confirmando, setConfirmando] = useState(false);

  const salir = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      cliente.clear();
      cliente.setQueryData(CLAVE_SESION, null);
    },
  });

  return (
    <>
      <div className="greeting">
        <div>
          <p>Hola,</p>
          <h1>{usuario?.nombre}</h1>
        </div>
        <Button icono aria-label="Cerrar sesión" onClick={() => setConfirmando(true)}>
          <SignOut size={20} aria-hidden="true" />
        </Button>
      </div>
      <div className="page" style={{ gap: 16 }}>
        {aviso && <Notice>{aviso}</Notice>}
        <Link to="/ventas/nueva" className="hero-accion">
          <span className="hero-accion-icono" aria-hidden="true">
            <ShoppingCartSimple size={24} weight="bold" />
          </span>
          <span className="hero-accion-texto">
            <strong>Registrar venta</strong>
            <span>Descuenta stock en dos toques</span>
          </span>
          <ArrowRight size={20} weight="bold" aria-hidden="true" />
        </Link>
      </div>
      <Dialog
        abierto={confirmando}
        titulo="¿Cerrar sesión?"
        onCerrar={() => setConfirmando(false)}
        acciones={
          <>
            <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
            <Button variante="primary" disabled={salir.isPending} onClick={() => salir.mutate()}>
              Cerrar sesión
            </Button>
          </>
        }
      >
        Tendrás que volver a ingresar tu correo y contraseña.
      </Dialog>
    </>
  );
}

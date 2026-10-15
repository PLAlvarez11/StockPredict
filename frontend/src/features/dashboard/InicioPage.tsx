import {
  ArrowRight,
  Calculator,
  CheckCircle,
  FolderSimplePlus,
  Package,
  PlusCircle,
  ShoppingCartSimple,
  SignOut,
  Sliders,
  Warning,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { IconBadge } from '../../components/ui/IconBadge';
import { Notice } from '../../components/ui/Notice';
import { authApi } from '../auth/api';
import { CLAVE_SESION, useSesion } from '../auth/useSesion';
import { prediccionApi } from '../prediccion/api';
import { CLAVE_PREDICCION } from '../prediccion/PrediccionPage';
import { useProductos } from '../productos/hooks';
import { useTitulo } from '../../lib/useTitulo';

const ATAJOS = [
  { ruta: '/productos/nuevo', etiqueta: 'Crear producto', Icono: PlusCircle },
  { ruta: '/categorias/nueva', etiqueta: 'Crear categoría', Icono: FolderSimplePlus },
  { ruta: '/inventario/compra', etiqueta: 'Registrar compra', Icono: Package },
  { ruta: '/inventario/ajuste', etiqueta: 'Ajustar stock', Icono: Sliders },
  { ruta: '/simulador', etiqueta: 'Simular stock', Icono: Calculator },
] as const;

function Resumen() {
  const productos = useProductos();
  const cargando = productos.isPending;
  const datos = productos.data;

  return (
    <section className="stats" aria-label="Resumen del inventario">
      <div className="stat card elev-sm">
        <div className="stat-label stat-ok">
          <Package size={14} weight="bold" aria-hidden="true" />
          Activos
        </div>
        <div className="stat-value">{cargando ? '–' : (datos?.total ?? '–')}</div>
        <div className="stat-sub">productos</div>
      </div>
      <div className="stat card stat-warn">
        <div className="stat-label">
          <Warning size={14} weight="bold" aria-hidden="true" />
          Stock bajo
        </div>
        <div className="stat-value">{cargando ? '–' : (datos?.stockBajo ?? '–')}</div>
        <div className="stat-sub">por revisar</div>
      </div>
      {productos.isError && (
        <p className="field-error stats-error" role="alert">
          No pudimos cargar el resumen.{' '}
          <button type="button" className="enlace" onClick={() => void productos.refetch()}>
            Reintentar
          </button>
        </p>
      )}
    </section>
  );
}

function PorComprar() {
  const prediccion = useQuery({
    queryKey: CLAVE_PREDICCION,
    queryFn: () => prediccionApi.obtener(),
    staleTime: 0,
  });
  const datos = prediccion.data;
  if (prediccion.isPending) return <div className="skeleton" style={{ height: 120 }} />;
  if (prediccion.isError || !datos || datos.totalActivos === 0) return null;

  const urgentes = datos.items.filter((i) => i.estado === 'comprar').slice(0, 3);

  return (
    <section className="card elev-sm por-comprar" aria-labelledby="por-comprar-titulo">
      <div className="por-comprar-cabecera">
        <h2 id="por-comprar-titulo" className="seccion-titulo">
          Para comprar esta semana
        </h2>
        <span className="por-comprar-total">
          {datos.totalAComprar} de {datos.totalActivos}
        </span>
      </div>
      {urgentes.length === 0 ? (
        <p className="por-comprar-vacio">
          <CheckCircle size={18} weight="bold" aria-hidden="true" />
          No es necesario comprar nada por ahora.
        </p>
      ) : (
        <ul className="por-comprar-lista">
          {urgentes.map((i) => (
            <li key={i.producto.id}>
              <IconBadge icono={i.producto.subcategoria.icono} tamano={16} />
              <span className="por-comprar-nombre">{i.producto.nombre}</span>
              <span className="tag tag-danger">{i.cantidadAComprar} u.</span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/prediccion" className="por-comprar-enlace">
        Ver predicción completa
        <ArrowRight size={14} weight="bold" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function InicioPage() {
  useTitulo('Inicio');
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

        <Resumen />

        <nav aria-label="Accesos rápidos" className="atajos">
          {ATAJOS.map(({ ruta, etiqueta, Icono }) => (
            <Link key={ruta} to={ruta} className="atajo">
              <Icono size={20} weight="bold" aria-hidden="true" />
              <span>{etiqueta}</span>
            </Link>
          ))}
        </nav>

        <PorComprar />
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

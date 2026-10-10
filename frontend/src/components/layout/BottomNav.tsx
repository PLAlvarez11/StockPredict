import { ChartLineUp, House, ShoppingBag, SquaresFour, Warehouse } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { NavLink } from 'react-router-dom';

interface Pestana {
  ruta: string;
  etiqueta: string;
  icono: Icon;
  fin?: boolean;
}

const PESTANAS: Pestana[] = [
  { ruta: '/', etiqueta: 'Inicio', icono: House, fin: true },
  { ruta: '/categorias', etiqueta: 'Categorías', icono: SquaresFour },
  { ruta: '/productos', etiqueta: 'Productos', icono: ShoppingBag },
  { ruta: '/inventario', etiqueta: 'Inventario', icono: Warehouse },
  { ruta: '/prediccion', etiqueta: 'Predicción', icono: ChartLineUp },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {PESTANAS.map(({ ruta, etiqueta, icono: Icono, fin }) => (
        <NavLink key={ruta} to={ruta} end={fin ?? false}>
          {({ isActive }) => (
            <>
              <Icono size={22} weight={isActive ? 'bold' : 'regular'} aria-hidden="true" />
              <span>{etiqueta}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

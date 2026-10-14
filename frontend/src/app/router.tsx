import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { PublicShell } from '../components/layout/PublicShell';
import { LoginPage } from '../features/auth/LoginPage';
import { RecuperarPage } from '../features/auth/RecuperarPage';
import { RegistroPage } from '../features/auth/RegistroPage';
import { RestablecerPage } from '../features/auth/RestablecerPage';
import { CategoriaFormPage } from '../features/categorias/CategoriaFormPage';
import { CategoriasPage } from '../features/categorias/CategoriasPage';
import { SubcategoriaFormPage } from '../features/subcategorias/SubcategoriaFormPage';
import { InicioPage } from '../features/dashboard/InicioPage';
import { ProductoFormPage } from '../features/productos/ProductoFormPage';
import { ProductosPage } from '../features/productos/ProductosPage';
import { AjustePage } from '../features/inventario/AjustePage';
import { CompraPage } from '../features/inventario/CompraPage';
import { InventarioPage } from '../features/inventario/InventarioPage';
import { VentaPage } from '../features/ventas/VentaPage';
import { PrediccionPage } from '../features/prediccion/PrediccionPage';
import { RutaPrivada, RutaPublica } from './guards';

export const router = createBrowserRouter([
  {
    element: <RutaPublica />,
    children: [
      {
        element: <PublicShell />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'registro', element: <RegistroPage /> },
          { path: 'recuperar', element: <RecuperarPage /> },
        ],
      },
    ],
  },
  {
    element: <PublicShell />,
    children: [{ path: 'restablecer', element: <RestablecerPage /> }],
  },
  {
    element: <RutaPrivada />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <InicioPage /> },
          { path: 'categorias', element: <CategoriasPage /> },
          { path: 'categorias/nueva', element: <CategoriaFormPage /> },
          { path: 'categorias/:id/editar', element: <CategoriaFormPage /> },
          { path: 'categorias/:id/subcategorias/nueva', element: <SubcategoriaFormPage /> },
          { path: 'categorias/:id/subcategorias/:subId/editar', element: <SubcategoriaFormPage /> },
          { path: 'productos', element: <ProductosPage /> },
          { path: 'productos/nuevo', element: <ProductoFormPage /> },
          { path: 'productos/:id/editar', element: <ProductoFormPage /> },
          { path: 'inventario', element: <InventarioPage /> },
          { path: 'inventario/compra', element: <CompraPage /> },
          { path: 'inventario/ajuste', element: <AjustePage /> },
          { path: 'ventas/nueva', element: <VentaPage /> },
          { path: 'prediccion', element: <PrediccionPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

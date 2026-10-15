import { Link } from 'react-router-dom';

export function EnlaceProducto({ id, nombre }: { id: number; nombre: string }) {
  return (
    <Link to={`/productos/${id}`} className="enlace-producto">
      {nombre}
    </Link>
  );
}

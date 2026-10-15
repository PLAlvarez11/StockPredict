import { Button } from '../../components/ui/Button';
import { useSubcategorias } from '../subcategorias/hooks';
import { useCategorias } from './hooks';

interface Props {
  categoriaId: number | undefined;
  subcategoriaId: number | undefined;
  onCategoria: (id: number | undefined) => void;
  onSubcategoria: (id: number | undefined) => void;
}

export function FiltrosCategoria({
  categoriaId,
  subcategoriaId,
  onCategoria,
  onSubcategoria,
}: Props) {
  const categorias = useCategorias();
  const subcategorias = useSubcategorias(categoriaId);
  return (
    <>
      {categorias.data && categorias.data.length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por categoría">
          <Button
            variante={categoriaId === undefined ? 'primary' : 'secondary'}
            aria-pressed={categoriaId === undefined}
            onClick={() => onCategoria(undefined)}
          >
            Todas
          </Button>
          {categorias.data.map((c) => (
            <Button
              key={c.id}
              variante={categoriaId === c.id ? 'primary' : 'secondary'}
              aria-pressed={categoriaId === c.id}
              onClick={() => onCategoria(c.id)}
            >
              {c.nombre}
            </Button>
          ))}
        </div>
      )}
      {categoriaId !== undefined && subcategorias.data && subcategorias.data.length > 0 && (
        <div className="chips chips-sub" role="group" aria-label="Filtrar por subcategoría">
          <Button
            variante={subcategoriaId === undefined ? 'primary' : 'secondary'}
            aria-pressed={subcategoriaId === undefined}
            onClick={() => onSubcategoria(undefined)}
          >
            Todas
          </Button>
          {subcategorias.data.map((s) => (
            <Button
              key={s.id}
              variante={subcategoriaId === s.id ? 'primary' : 'secondary'}
              aria-pressed={subcategoriaId === s.id}
              onClick={() => onSubcategoria(s.id)}
            >
              {s.nombre}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

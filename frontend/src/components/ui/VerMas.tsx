import { Button } from './Button';

interface Props {
  mostrados: number;
  total: number;
  hayMas: boolean;
  cargando: boolean;
  onVerMas: () => void;
}

export function VerMas({ mostrados, total, hayMas, cargando, onVerMas }: Props) {
  if (!hayMas) return null;
  return (
    <div className="ver-mas">
      <p className="list-row-sub">
        Mostrando {mostrados} de {total}
      </p>
      <Button disabled={cargando} onClick={onVerMas}>
        {cargando ? 'Cargando…' : 'Ver más'}
      </Button>
    </div>
  );
}

import { CheckCircle, X } from '@phosphor-icons/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface Contexto {
  avisar: (texto: string) => void;
}

const AvisosContexto = createContext<Contexto>({ avisar: () => undefined });

export const useAviso = () => useContext(AvisosContexto).avisar;

const DURACION_MS = 8000;

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const contador = useRef(0);

  const avisar = useCallback((texto: string) => {
    contador.current += 1;
    setAviso({ id: contador.current, texto });
  }, []);

  useEffect(() => {
    if (!aviso) return undefined;
    const id = setTimeout(() => setAviso(null), DURACION_MS);
    return () => clearTimeout(id);
  }, [aviso]);

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <AvisosContexto value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite" aria-atomic="true">
        {aviso && (
          <div key={aviso.id} className="notice avisos-contenido">
            <CheckCircle size={20} weight="bold" aria-hidden="true" />
            <div>{aviso.texto}</div>
            <button
              type="button"
              className="avisos-cerrar"
              aria-label="Cerrar aviso"
              onClick={() => setAviso(null)}
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </AvisosContexto>
  );
}

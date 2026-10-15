import { MagnifyingGlass, X } from '@phosphor-icons/react';

interface Props {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  placeholder?: string;
}

export function Buscador({ etiqueta, valor, onCambio, placeholder }: Props) {
  return (
    <div className="buscador" role="search">
      <MagnifyingGlass size={20} aria-hidden="true" />
      <input
        type="search"
        className="input"
        aria-label={etiqueta}
        placeholder={placeholder ?? etiqueta}
        autoComplete="off"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
      {valor !== '' && (
        <button
          type="button"
          className="buscador-limpiar"
          aria-label="Limpiar búsqueda"
          onClick={() => onCambio('')}
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  acciones: ReactNode;
}

export function Dialog({ abierto, titulo, onCerrar, children, acciones }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
    >
      <h2 id={idTitulo}>{titulo}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{acciones}</div>
    </dialog>
  );
}

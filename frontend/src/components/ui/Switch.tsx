import { useId, type InputHTMLAttributes, type Ref } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  etiqueta: string;
  ayuda?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

export function Switch({ etiqueta, ayuda, id, ref, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idAyuda = `${idCampo}-ayuda`;
  return (
    <div className="field">
      <label className="switch" htmlFor={idCampo}>
        <span>{etiqueta}</span>
        <input
          id={idCampo}
          ref={ref}
          type="checkbox"
          role="switch"
          aria-describedby={ayuda ? idAyuda : undefined}
          {...resto}
        />
        <span className="switch-pista" aria-hidden="true" />
      </label>
      {ayuda && (
        <p id={idAyuda} className="field-hint">
          {ayuda}
        </p>
      )}
    </div>
  );
}

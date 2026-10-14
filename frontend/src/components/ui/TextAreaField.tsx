import { WarningCircle } from '@phosphor-icons/react';
import { useId, type Ref, type TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: string | undefined;
  caracteres?: number | undefined;
  maximo?: number | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextAreaField({
  etiqueta,
  error,
  ayuda,
  caracteres,
  maximo,
  id,
  ref,
  ...resto
}: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idError = `${idCampo}-error`;
  const idAyuda = `${idCampo}-ayuda`;
  const describedBy = [error ? idError : '', ayuda || maximo ? idAyuda : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <textarea
        id={idCampo}
        ref={ref}
        className="input"
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...resto}
      />
      {(ayuda || maximo !== undefined) && (
        <p id={idAyuda} className="field-hint field-hint-fila">
          <span>{ayuda}</span>
          {maximo !== undefined && (
            <span aria-hidden="true">
              {caracteres ?? 0}/{maximo}
            </span>
          )}
        </p>
      )}
      {error && (
        <p id={idError} className="field-error" role="alert">
          <WarningCircle size={16} weight="bold" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

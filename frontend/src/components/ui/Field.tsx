import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import { useId, useState, type InputHTMLAttributes, type Ref } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

export function Field({ etiqueta, error, ayuda, id, type = 'text', ref, ...resto }: Props) {
  const generado = useId();
  const idCampo = id ?? generado;
  const idError = `${idCampo}-error`;
  const idAyuda = `${idCampo}-ayuda`;
  const [visible, setVisible] = useState(false);
  const esContrasena = type === 'password';

  const describedBy = [error ? idError : '', ayuda ? idAyuda : ''].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label htmlFor={idCampo}>{etiqueta}</label>
      <div className={esContrasena ? 'password-wrap' : undefined}>
        <input
          id={idCampo}
          ref={ref}
          className="input"
          type={esContrasena && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...resto}
        />
        {esContrasena && (
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {ayuda && !error && (
        <p id={idAyuda} className="field-hint">
          {ayuda}
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

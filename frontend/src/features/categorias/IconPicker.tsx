import { WarningCircle } from '@phosphor-icons/react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { DETALLE_ICONOS, ICONOS_CATEGORIA } from '../../lib/iconos';

interface Props {
  registro: UseFormRegisterReturn;
  error?: string | undefined;
}

export function IconPicker({ registro, error }: Props) {
  return (
    <fieldset className="icon-picker" aria-describedby={error ? 'icono-error' : 'icono-ayuda'}>
      <legend>Ícono de la categoría</legend>
      <div className="icon-grid">
        {ICONOS_CATEGORIA.map((nombre) => {
          const { nombre: etiqueta, Icono } = DETALLE_ICONOS[nombre];
          return (
            <label key={nombre} className="icon-option">
              <input type="radio" value={nombre} {...registro} />
              <span className="icon-cell">
                <Icono size={22} weight="bold" aria-hidden="true" />
              </span>
              <span className="sr-only">{etiqueta}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id="icono-error" className="field-error" role="alert">
          <WarningCircle size={16} weight="bold" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <p id="icono-ayuda" className="field-hint">
          Este ícono aparecerá junto a cada producto de la categoría.
        </p>
      )}
    </fieldset>
  );
}

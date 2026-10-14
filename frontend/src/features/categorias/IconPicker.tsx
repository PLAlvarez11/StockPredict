import { WarningCircle } from '@phosphor-icons/react';
import { createElement } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { DETALLE_ICONOS, ICONOS_CATEGORIA, iconoDe } from '../../lib/iconos';

interface Props {
  registro: UseFormRegisterReturn;
  error?: string | undefined;
  titulo?: string;
  ayuda?: string;
  heredar?: { icono: string; texto: string };
}

export function IconPicker({
  registro,
  error,
  titulo = 'Ícono de la categoría',
  ayuda = 'Este ícono aparecerá junto a cada producto de la categoría.',
  heredar,
}: Props) {
  return (
    <fieldset className="icon-picker" aria-describedby={error ? 'icono-error' : 'icono-ayuda'}>
      <legend>{titulo}</legend>
      <div className="icon-grid">
        {heredar && (
          <label className="icon-option">
            <input type="radio" value="" {...registro} />
            <span className="icon-cell">
              {createElement(iconoDe(heredar.icono), {
                size: 22,
                weight: 'bold',
                'aria-hidden': true,
              })}
            </span>
            <span className="sr-only">{heredar.texto}</span>
          </label>
        )}
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
          {heredar ? `${heredar.texto} es la primera opción. ` : ''}
          {ayuda}
        </p>
      )}
    </fieldset>
  );
}

import { CaretDown, CheckCircle, Info, ShoppingCartSimple } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import { IconBadge } from '../../components/ui/IconBadge';
import type { ItemPrediccion, Semaforo } from './api';
import { CalculoLista } from './CalculoLista';

const CLASE_TAG: Record<Semaforo, string> = {
  rojo: 'tag-danger',
  ambar: 'tag-warn',
  verde: 'tag-ok',
  neutro: 'tag-neutral',
};

export function PrediccionCard({ item }: { item: ItemPrediccion }) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  const { producto } = item;
  const porcentaje = item.necesidadPct;

  return (
    <article className="card elev-md pred-card">
      <div className="pred-head">
        <IconBadge icono={producto.subcategoria.icono} />
        <div className="list-row-main">
          <h2 className="list-row-title">{producto.nombre}</h2>
          <div className="list-row-sub">
            {producto.categoria.nombre} · {producto.subcategoria.nombre}
          </div>
        </div>
        <span className={`tag ${CLASE_TAG[item.semaforo]}`}>
          <span className="sr-only">Necesidad de compra: </span>
          {porcentaje === null ? 'Sin dato' : `${porcentaje} %`}
        </span>
      </div>

      {porcentaje !== null && (
        <div
          className={`pred-barra pred-barra-${item.semaforo}`}
          role="progressbar"
          aria-label={`Necesidad de compra de ${producto.nombre}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
        >
          <div style={{ width: `${porcentaje}%` }} />
        </div>
      )}

      <div className="pred-cells">
        <div className="pred-cell">
          <div className="pred-cell-label">Stock actual</div>
          <div className="pred-cell-value">{item.stockActual}</div>
        </div>
        <div className="pred-cell">
          <div className="pred-cell-label">Sugerido sem.</div>
          <div className="pred-cell-value">{item.stockSugerido ?? '—'}</div>
        </div>
      </div>

      {item.estado === 'comprar' && (
        <div className="pred-status pred-comprar">
          <span className="pred-status-texto">
            <ShoppingCartSimple size={16} weight="bold" aria-hidden="true" />
            Comprar ahora
          </span>
          <span className="pred-status-cantidad">{item.cantidadAComprar} u.</span>
        </div>
      )}
      {item.estado === 'suficiente' && (
        <div className="pred-status pred-suficiente">
          <span className="pred-status-texto">
            <CheckCircle size={16} weight="bold" aria-hidden="true" />
            Stock suficiente
          </span>
          <span className="pred-status-nota">No es necesario comprar</span>
        </div>
      )}
      {item.estado === 'sin_historial' && (
        <div className="pred-status pred-sin-historial">
          <span className="pred-status-texto">
            <Info size={16} weight="bold" aria-hidden="true" />
            Sin historial suficiente
          </span>
        </div>
      )}

      <button
        type="button"
        className="calc-toggle"
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => setAbierto((v) => !v)}
      >
        {abierto ? 'Ocultar cálculo' : 'Ver cálculo'}
        <CaretDown size={14} weight="bold" aria-hidden="true" className={abierto ? 'girado' : ''} />
      </button>
      <div id={idPanel} className="calc-panel" hidden={!abierto}>
        {abierto &&
          (item.calculo && item.origen ? (
            <CalculoLista
              calculo={item.calculo}
              origen={item.origen}
              categoria={producto.categoria.nombre}
              subcategoria={producto.subcategoria.nombre}
              stockActual={item.stockActual}
            />
          ) : (
            <p className="calc-nota">
              No hay ventas del producto ni de otros productos de su subcategoría o categoría en las
              últimas 3 semanas cerradas, así que no se puede sugerir una compra.
            </p>
          ))}
      </div>
    </article>
  );
}

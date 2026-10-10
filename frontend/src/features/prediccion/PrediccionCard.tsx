import { CaretDown, CheckCircle, Info, ShoppingCartSimple } from '@phosphor-icons/react';
import { useId, useState } from 'react';
import { IconBadge } from '../../components/ui/IconBadge';
import { formatearNumero as fmt } from '../../lib/formato';
import type { ItemPrediccion } from './api';

function Fila({ etiqueta, detalle, valor }: { etiqueta: string; detalle?: string; valor: string }) {
  return (
    <div className="calc-fila">
      <dt>
        {etiqueta}
        {detalle && <span className="calc-detalle">{detalle}</span>}
      </dt>
      <dd>{valor}</dd>
    </div>
  );
}

function Calculo({ item }: { item: ItemPrediccion }) {
  const c = item.calculo;
  if (!c || !item.origen) {
    return (
      <p className="calc-nota">
        No hay ventas del producto ni de otros productos de su categoría en las últimas 3 semanas
        cerradas, así que no se puede sugerir una compra.
      </p>
    );
  }
  const porCategoria = item.origen === 'categoria';
  return (
    <>
      <p className="calc-nota">
        {porCategoria
          ? `Producto con menos de 3 semanas de historial: se usó el promedio por producto de su categoría (${c.productosBase} ${c.productosBase === 1 ? 'producto' : 'productos'}).`
          : 'Se usó el historial de ventas del propio producto.'}
      </p>
      <dl className="calc-lista">
        <Fila etiqueta="V1" detalle="semana cerrada más reciente" valor={`${fmt(c.v1)} u.`} />
        <Fila etiqueta="V2" detalle="semana anterior" valor={`${fmt(c.v2)} u.`} />
        <Fila etiqueta="V3" detalle="hace 3 semanas" valor={`${fmt(c.v3)} u.`} />
        <Fila
          etiqueta="Promedio ponderado"
          detalle="0.5·V1 + 0.3·V2 + 0.2·V3"
          valor={fmt(c.ponderado)}
        />
        <Fila
          etiqueta="Factor de tendencia"
          detalle={c.v2 === 0 ? 'V2 = 0, se usa 1' : 'V1 ÷ V2'}
          valor={fmt(c.factorTendencia)}
        />
        <Fila
          etiqueta="Factor ajustado"
          detalle="1 + (factor − 1) × 50 %"
          valor={fmt(c.factorAjustado)}
        />
        <Fila
          etiqueta="Stock ajustado"
          detalle="promedio × factor ajustado"
          valor={fmt(c.stockAjustado)}
        />
        <Fila
          etiqueta="Margen de seguridad"
          detalle="× (1 + 20 %)"
          valor={`${fmt(c.margen * 100)} %`}
        />
        <Fila
          etiqueta="Stock sugerido"
          detalle="redondeo hacia arriba"
          valor={`${fmt(c.stockSugerido)} u.`}
        />
        <Fila etiqueta="Stock actual" valor={`${fmt(item.stockActual)} u.`} />
        <Fila
          etiqueta="Cantidad a comprar"
          detalle="sugerido − actual"
          valor={`${fmt(c.cantidadAComprar)} u.`}
        />
      </dl>
    </>
  );
}

export function PrediccionCard({ item }: { item: ItemPrediccion }) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();
  const { producto } = item;

  return (
    <article className="card elev-md pred-card">
      <div className="pred-head">
        <IconBadge icono={producto.categoria.icono} />
        <div className="list-row-main">
          <h2 className="list-row-title">{producto.nombre}</h2>
          <div className="list-row-sub">{producto.categoria.nombre}</div>
        </div>
      </div>

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
        {abierto && <Calculo item={item} />}
      </div>
    </article>
  );
}

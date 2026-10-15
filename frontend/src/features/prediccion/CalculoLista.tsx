import { formatearNumero as fmt } from '../../lib/formato';
import type { CalculoDetalle, OrigenCalculo } from './api';

interface Props {
  calculo: CalculoDetalle;
  origen: OrigenCalculo;
  categoria: string;
  subcategoria?: string | undefined;
  stockActual?: number | null | undefined;
}

const ORIGEN_ROTULO: Record<OrigenCalculo, string> = {
  producto: 'Sus propias ventas',
  subcategoria: 'Promedio de su subcategoría',
  categoria: 'Promedio de su categoría',
};

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

function nota(origen: OrigenCalculo, c: CalculoDetalle, categoria: string, subcategoria?: string) {
  const productos = `${c.productosBase} ${c.productosBase === 1 ? 'producto' : 'productos'}`;
  if (origen === 'producto') {
    return `Se usó el historial de ventas del propio producto, con una reserva extra de ${c.margenPorCiento} %.`;
  }
  const donde =
    origen === 'subcategoria'
      ? `su subcategoría «${subcategoria ?? ''}»`
      : `su categoría «${categoria}»`;
  return `Menos de 3 semanas de historial: se usó el promedio por producto de ${donde} (${productos}). Como aún no tiene 3 semanas de ventas propias, la reserva extra baja a ${c.margenPorCiento} %.`;
}

export function CalculoLista({ calculo: c, origen, categoria, subcategoria, stockActual }: Props) {
  const tieneStock = stockActual !== null && stockActual !== undefined;
  return (
    <>
      <p className="calc-nota">{nota(origen, c, categoria, subcategoria)}</p>
      <dl className="calc-lista">
        <Fila etiqueta="De dónde sale el cálculo" valor={ORIGEN_ROTULO[origen]} />
        <Fila etiqueta="V1" detalle="última semana completa" valor={`${fmt(c.v1)} u.`} />
        <Fila etiqueta="V2" detalle="semana anterior" valor={`${fmt(c.v2)} u.`} />
        <Fila etiqueta="V3" detalle="hace 3 semanas" valor={`${fmt(c.v3)} u.`} />
        <Fila
          etiqueta="Promedio de ventas"
          detalle="las semanas más recientes pesan más"
          valor={fmt(c.ponderado)}
        />
        <Fila
          etiqueta="Cambio de ventas"
          detalle={c.v2 === 0 ? 'V2 = 0, se usa 1' : 'V1 ÷ V2'}
          valor={fmt(c.factorTendencia)}
        />
        <Fila
          etiqueta="Cambio suavizado"
          detalle="1 + (factor − 1) × 50 %"
          valor={fmt(c.factorAjustado)}
        />
        <Fila
          etiqueta="Stock con el cambio"
          detalle="promedio × cambio suavizado"
          valor={fmt(c.stockAjustado)}
        />
        <Fila
          etiqueta="Reserva extra"
          detalle={`× (1 + ${c.margenPorCiento} %)`}
          valor={`${fmt(c.margenPorCiento)} %`}
        />
        <Fila
          etiqueta="Stock sugerido"
          detalle="se redondea hacia arriba"
          valor={`${fmt(c.stockSugerido)} u.`}
        />
        {tieneStock && (
          <>
            <Fila etiqueta="Stock actual" valor={`${fmt(stockActual)} u.`} />
            <Fila
              etiqueta="Cantidad a comprar"
              detalle="sugerido menos el que tienes"
              valor={`${fmt(c.cantidadAComprar)} u.`}
            />
          </>
        )}
      </dl>
    </>
  );
}

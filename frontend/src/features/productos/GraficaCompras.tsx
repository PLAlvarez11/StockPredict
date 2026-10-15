import { ChartLine } from '@phosphor-icons/react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { GraficaSvg } from '../../components/charts/GraficaSvg';
import { formatearNumero } from '../../lib/formato';
import type { ComprasProducto, SemanaCompras } from './comprasApi';

const dia = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fecha = (texto: string) => dia.format(new Date(`${texto}T12:00:00Z`));
const rango = (s: SemanaCompras) => `del ${fecha(s.inicio)} al ${fecha(s.fin)}`;

export function resumenCompras({ total, semanaMayor, semanas }: ComprasProducto): string {
  const desde = semanas[0];
  const hasta = semanas[semanas.length - 1];
  if (total === 0 || !semanaMayor || !desde || !hasta) {
    return `No hay compras registradas en las últimas ${semanas.length} semanas.`;
  }
  return `Compras por semana, ${rango({ ...desde, fin: hasta.fin })}. Total comprado: ${formatearNumero(total)} u. Semana de mayor compra: ${rango(semanaMayor)}, ${formatearNumero(semanaMayor.cantidad)} u.`;
}

export function GraficaCompras({
  compras,
  idProducto,
}: {
  compras: ComprasProducto;
  idProducto: number;
}) {
  const idTitulo = useId();
  const { semanas, total } = compras;

  return (
    <section className="card elev-sm grafica" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="grafica-titulo">
        Compras a lo largo del tiempo
      </h2>
      {total === 0 ? (
        <>
          <p className="grafica-resumen">
            Aún no hay compras registradas de este producto en las últimas {semanas.length} semanas.
            Cuando registres una, la verás aquí.
          </p>
          <Link
            to={`/inventario/compra?productoId=${idProducto}`}
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
          >
            <ChartLine size={16} aria-hidden="true" />
            Registrar compra
          </Link>
        </>
      ) : (
        <GraficaSvg
          tipo="linea"
          etiquetasCada={3}
          puntos={semanas.map((s) => ({
            clave: s.inicio,
            etiqueta: fecha(s.inicio),
            cantidad: s.cantidad,
            descripcion: `${rango(s)}${s.enCurso ? ' (en curso)' : ''}`,
          }))}
          resumen={resumenCompras(compras)}
          tituloTabla="Unidades compradas por semana (de lunes a domingo)"
          etiquetaColumna="Semana"
        />
      )}
    </section>
  );
}

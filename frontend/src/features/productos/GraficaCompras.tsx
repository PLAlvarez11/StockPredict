import { ChartLine } from '@phosphor-icons/react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { formatearNumero } from '../../lib/formato';
import type { ComprasProducto, SemanaCompras } from './comprasApi';

const ANCHO = 320;
const ALTO = 150;
const MARGEN = { izq: 26, der: 10, arriba: 14, abajo: 26 };

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
  const idDescripcion = useId();
  const { semanas, total } = compras;

  if (total === 0) {
    return (
      <section className="card elev-sm grafica" aria-labelledby={idTitulo}>
        <h2 id={idTitulo} className="grafica-titulo">
          Compras a lo largo del tiempo
        </h2>
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
      </section>
    );
  }

  const maximo = Math.max(...semanas.map((s) => s.cantidad), 1);
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) =>
    MARGEN.izq + (semanas.length === 1 ? 0 : (i / (semanas.length - 1)) * anchoUtil);
  const y = (cantidad: number) => MARGEN.arriba + altoUtil - (cantidad / maximo) * altoUtil;
  const puntos = semanas.map((s, i) => `${x(i).toFixed(1)},${y(s.cantidad).toFixed(1)}`).join(' ');
  const marcas = semanas
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i % 3 === 0 || i === semanas.length - 1);

  return (
    <section className="card elev-sm grafica" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className="grafica-titulo">
        Compras a lo largo del tiempo
      </h2>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-labelledby={idDescripcion}
        focusable="false"
      >
        <title id={idDescripcion}>{resumenCompras(compras)}</title>
        <rect width={ANCHO} height={ALTO} fill="var(--color-bg)" />
        <line
          className="grafica-guia"
          x1={MARGEN.izq}
          x2={ANCHO - MARGEN.der}
          y1={y(maximo)}
          y2={y(maximo)}
        />
        <line className="grafica-eje" x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y(0)} y2={y(0)} />
        <text className="grafica-texto" x={MARGEN.izq - 6} y={y(maximo) + 3} textAnchor="end">
          {formatearNumero(maximo)}
        </text>
        <text className="grafica-texto" x={MARGEN.izq - 6} y={y(0) + 3} textAnchor="end">
          0
        </text>
        <polyline className="grafica-linea" points={puntos} />
        {semanas.map((s, i) => (
          <circle key={s.inicio} className="grafica-punto" cx={x(i)} cy={y(s.cantidad)} r={3.5} />
        ))}
        {marcas.map(({ s, i }) => (
          <text
            key={s.inicio}
            className="grafica-texto"
            x={x(i)}
            y={ALTO - 8}
            textAnchor={i === 0 ? 'start' : i === semanas.length - 1 ? 'end' : 'middle'}
          >
            {fecha(s.inicio)}
          </text>
        ))}
      </svg>
      <p className="grafica-resumen">{resumenCompras(compras)}</p>
      <table className="sr-only">
        <caption>Unidades compradas por semana (de lunes a domingo)</caption>
        <thead>
          <tr>
            <th scope="col">Semana</th>
            <th scope="col">Unidades</th>
          </tr>
        </thead>
        <tbody>
          {semanas.map((s) => (
            <tr key={s.inicio}>
              <th scope="row">
                {rango(s)}
                {s.enCurso ? ' (en curso)' : ''}
              </th>
              <td>{s.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

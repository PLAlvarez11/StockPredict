import { useId } from 'react';
import { formatearNumero } from '../../lib/formato';

export interface PuntoGrafica {
  clave: string;
  etiqueta: string;
  cantidad: number;
  descripcion: string;
  marcar?: boolean;
}

interface Props {
  tipo: 'linea' | 'barras';
  puntos: PuntoGrafica[];
  resumen: string;
  tituloTabla: string;
  etiquetaColumna: string;
  etiquetasCada?: number;
}

const ANCHO = 320;
const ALTO = 160;
const MARGEN = { izq: 30, der: 10, arriba: 18, abajo: 30 };

export function GraficaSvg({
  tipo,
  puntos,
  resumen,
  tituloTabla,
  etiquetaColumna,
  etiquetasCada = 1,
}: Props) {
  const idTitulo = useId();
  const maximo = Math.max(...puntos.map((p) => p.cantidad), 1);
  const anchoUtil = ANCHO - MARGEN.izq - MARGEN.der;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const paso = anchoUtil / puntos.length;
  const x = (i: number) =>
    tipo === 'barras'
      ? MARGEN.izq + paso * i + paso / 2
      : MARGEN.izq + (puntos.length === 1 ? 0 : (i / (puntos.length - 1)) * anchoUtil);
  const y = (cantidad: number) => MARGEN.arriba + altoUtil - (cantidad / maximo) * altoUtil;
  const ancho = Math.min(paso * 0.6, 28);

  return (
    <>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-labelledby={idTitulo} focusable="false">
        <title id={idTitulo}>{resumen}</title>
        <rect width={ANCHO} height={ALTO} fill="var(--color-bg)" />
        <line
          className="grafica-guia"
          x1={MARGEN.izq}
          x2={ANCHO - MARGEN.der}
          y1={y(maximo)}
          y2={y(maximo)}
        />
        <line className="grafica-eje" x1={MARGEN.izq} x2={ANCHO - MARGEN.der} y1={y(0)} y2={y(0)} />
        <text className="grafica-texto" x={MARGEN.izq - 6} y={y(maximo) + 4} textAnchor="end">
          {formatearNumero(maximo)}
        </text>
        <text className="grafica-texto" x={MARGEN.izq - 6} y={y(0) + 4} textAnchor="end">
          0
        </text>
        {tipo === 'linea' ? (
          <>
            <polyline
              className="grafica-linea"
              points={puntos
                .map((p, i) => `${x(i).toFixed(1)},${y(p.cantidad).toFixed(1)}`)
                .join(' ')}
            />
            {puntos.map((p, i) => (
              <circle
                key={p.clave}
                className="grafica-punto"
                cx={x(i)}
                cy={y(p.cantidad)}
                r={3.5}
              />
            ))}
          </>
        ) : (
          puntos.map((p, i) => (
            <g key={p.clave}>
              <rect
                className={p.marcar ? 'grafica-barra grafica-barra-mayor' : 'grafica-barra'}
                x={x(i) - ancho / 2}
                y={y(p.cantidad)}
                width={ancho}
                height={Math.max(y(0) - y(p.cantidad), p.cantidad > 0 ? 2 : 0)}
                rx={3}
              />
              {p.cantidad > 0 && (
                <text className="grafica-texto" x={x(i)} y={y(p.cantidad) - 4} textAnchor="middle">
                  {p.cantidad}
                </text>
              )}
            </g>
          ))
        )}
        {puntos.map((p, i) =>
          i % etiquetasCada === 0 || i === puntos.length - 1 ? (
            <text
              key={p.clave}
              className="grafica-texto"
              x={x(i)}
              y={ALTO - 8}
              textAnchor={
                tipo === 'barras'
                  ? 'middle'
                  : i === 0
                    ? 'start'
                    : i === puntos.length - 1
                      ? 'end'
                      : 'middle'
              }
            >
              {p.etiqueta}
            </text>
          ) : null,
        )}
      </svg>
      <p className="grafica-resumen">{resumen}</p>
      <div className="sr-only">
        <table>
          <caption>{tituloTabla}</caption>
          <thead>
            <tr>
              <th scope="col">{etiquetaColumna}</th>
              <th scope="col">Unidades</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.clave}>
                <th scope="row">{p.descripcion}</th>
                <td>{p.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

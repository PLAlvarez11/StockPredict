import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { GraficaSvg } from '../../components/charts/GraficaSvg';
import { ErrorState } from '../../components/ui/ErrorState';
import { api } from '../../lib/apiClient';
import { formatearNumero } from '../../lib/formato';

export interface DiaVentas {
  fecha: string;
  cantidad: number;
  esHoy: boolean;
}

export interface VentasSemanaDatos {
  inicio: string;
  fin: string;
  dias: DiaVentas[];
  total: number;
  diaMayor: DiaVentas | null;
}

export const CLAVE_VENTAS_SEMANA = ['ventas', 'semana'] as const;

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const fecha = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const texto = (d: string) => fecha.format(new Date(`${d}T12:00:00Z`));

export function resumenVentas({ total, diaMayor, dias }: VentasSemanaDatos): string {
  const desde = dias[0];
  const hasta = dias[dias.length - 1];
  if (total === 0 || !diaMayor || !desde || !hasta) {
    return 'Todavía no hay ventas esta semana.';
  }
  const indice = dias.findIndex((d) => d.fecha === diaMayor.fecha);
  return `Ventas de la semana, del ${texto(desde.fecha)} al ${texto(hasta.fecha)}. Total vendido: ${formatearNumero(total)} u. Día de mayor venta: ${NOMBRES[indice] ?? ''} ${texto(diaMayor.fecha)}, ${formatearNumero(diaMayor.cantidad)} u.`;
}

export default function VentasSemana() {
  const idTitulo = useId();
  const ventas = useQuery({
    queryKey: CLAVE_VENTAS_SEMANA,
    queryFn: () => api<VentasSemanaDatos>('GET', '/ventas/semana'),
    staleTime: 0,
  });
  const datos = ventas.data;

  return (
    <section className="card elev-sm grafica" aria-labelledby={idTitulo}>
      <div className="grafica-cabecera">
        <h2 id={idTitulo} className="grafica-titulo">
          Ventas de la semana
        </h2>
        {datos && <span className="grafica-total">{formatearNumero(datos.total)} u.</span>}
      </div>
      {ventas.isPending && <div className="skeleton" style={{ height: 160 }} />}
      {ventas.isError && <ErrorState onReintentar={() => void ventas.refetch()} />}
      {datos && datos.total === 0 && (
        <p className="grafica-resumen">
          Todavía no hay ventas esta semana. Cuando registres una, la verás aquí.
        </p>
      )}
      {datos && datos.total > 0 && (
        <GraficaSvg
          tipo="barras"
          puntos={datos.dias.map((d, i) => ({
            clave: d.fecha,
            etiqueta: INICIALES[i] ?? '',
            cantidad: d.cantidad,
            descripcion: `${NOMBRES[i] ?? ''} ${texto(d.fecha)}${d.esHoy ? ' (hoy)' : ''}`,
            marcar: d.fecha === datos.diaMayor?.fecha,
          }))}
          resumen={resumenVentas(datos)}
          tituloTabla="Unidades vendidas por día (semana de lunes a domingo)"
          etiquetaColumna="Día"
        />
      )}
    </section>
  );
}

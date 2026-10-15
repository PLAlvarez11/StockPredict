import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { SelectField } from '../../components/ui/SelectField';
import { useRetraso } from '../../lib/useRetraso';
import { useCategorias } from '../categorias/hooks';
import { useSubcategorias } from '../subcategorias/hooks';
import { prediccionApi } from './api';
import { CalculoLista } from './CalculoLista';

const MAXIMO_STOCK = 1_000_000;

export function SimuladorPage() {
  const categorias = useCategorias();
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [nombre, setNombre] = useState('');
  const [stock, setStock] = useState('');
  const [verCalculo, setVerCalculo] = useState(false);

  const categoriaId = categoria === '' ? undefined : Number(categoria);
  const subcategorias = useSubcategorias(categoriaId);
  const nombreFinal = useRetraso(nombre.trim());
  const stockTexto = useRetraso(stock.trim());
  const stockNumero = stockTexto === '' ? undefined : Number(stockTexto);
  const stockInvalido =
    stockNumero !== undefined &&
    (!Number.isInteger(stockNumero) || stockNumero < 0 || stockNumero > MAXIMO_STOCK);

  const entrada = {
    categoriaId: categoriaId as number,
    subcategoriaId: subcategoria === '' ? undefined : Number(subcategoria),
    nombre: nombreFinal === '' ? undefined : nombreFinal,
    stockActual: stockInvalido ? undefined : stockNumero,
  };
  const simulacion = useQuery({
    queryKey: ['simulacion', entrada],
    queryFn: () => prediccionApi.simular(entrada),
    enabled: categoriaId !== undefined,
    staleTime: 0,
  });
  const datos = simulacion.data;

  let resultado;
  if (categoriaId === undefined) {
    resultado = <p className="calc-nota">Elige una categoría para ver la estimación.</p>;
  } else if (simulacion.isError) {
    resultado = <ErrorState onReintentar={() => void simulacion.refetch()} />;
  } else if (!datos) {
    resultado = <div className="skeleton" style={{ height: 72 }} />;
  } else if (datos.estado === 'sin_historial' || datos.stockSugerido === null) {
    resultado = (
      <p className="calc-nota">
        Sin historial suficiente: no hay ventas en las últimas 3 semanas cerradas ni en la
        subcategoría ni en la categoría elegidas, así que no se puede estimar.
      </p>
    );
  } else {
    resultado = (
      <>
        <p className="sim-valor">{datos.stockSugerido} u.</p>
        {datos.nombre && <p className="calc-nota">Para «{datos.nombre}».</p>}
        {datos.cantidadAComprar !== null && datos.necesidadPct !== null && (
          <p className="calc-nota">
            Con {datos.stockActual} u. en stock habría que comprar{' '}
            <strong>{datos.cantidadAComprar} u.</strong> ({datos.necesidadPct} % del sugerido).
          </p>
        )}
        <button
          type="button"
          className="calc-toggle"
          aria-expanded={verCalculo}
          aria-controls="sim-calculo"
          onClick={() => setVerCalculo((v) => !v)}
        >
          {verCalculo ? 'Ocultar cálculo' : 'Ver cálculo'}
        </button>
        <div id="sim-calculo" className="calc-panel" hidden={!verCalculo}>
          {verCalculo && datos.calculo && datos.origen && (
            <CalculoLista
              calculo={datos.calculo}
              origen={datos.origen}
              categoria={datos.categoria.nombre}
              subcategoria={datos.subcategoria?.nombre}
              stockActual={datos.stockActual}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <ScreenHeader titulo="Simulador de stock" atras="/" />
      <div className="page" style={{ gap: 16 }}>
        <Notice tipo="aviso">
          Esto es una simulación. No se guarda ningún cambio en tu inventario.
        </Notice>
        <SelectField
          etiqueta="Categoría"
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setSubcategoria('');
          }}
        >
          <option value="">Elige una categoría</option>
          {(categorias.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </SelectField>
        <SelectField
          etiqueta="Subcategoría (opcional)"
          value={subcategoria}
          disabled={categoriaId === undefined}
          onChange={(e) => setSubcategoria(e.target.value)}
        >
          <option value="">Todas</option>
          {(subcategorias.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </SelectField>
        <Field
          etiqueta="Nombre del producto (opcional)"
          placeholder="ej. Blusa nueva temporada"
          autoComplete="off"
          maxLength={150}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Field
          etiqueta="Stock actual (opcional)"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          ayuda="Si lo indicas, también te decimos cuánto comprar."
          error={stockInvalido ? 'Ingresa un número entero de 0 en adelante.' : undefined}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
        <section
          className="card elev-md sim-resultado"
          aria-live="polite"
          aria-labelledby="sim-titulo"
        >
          <h2 id="sim-titulo" className="sim-titulo">
            Stock sugerido estimado
          </h2>
          {resultado}
        </section>
      </div>
    </>
  );
}

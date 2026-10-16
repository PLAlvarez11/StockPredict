import { FileCsv, FilePdf, FileXls, WarningCircle, type Icon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useAviso } from '../../components/layout/Avisos';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/apiClient';
import type { FiltrosPrediccion, FormatoExportacion } from './api';
import { exportarPrediccion } from './exportarApi';

interface Props {
  abierto: boolean;
  filtros: FiltrosPrediccion;
  onCerrar: () => void;
}

const FORMATOS: { id: FormatoExportacion; etiqueta: string; Icono: Icon }[] = [
  { id: 'pdf', etiqueta: 'PDF', Icono: FilePdf },
  { id: 'xlsx', etiqueta: 'Excel', Icono: FileXls },
  { id: 'csv', etiqueta: 'CSV', Icono: FileCsv },
];

function descargar(blob: Blob, nombre: string): void {
  const direccion = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = direccion;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(direccion), 10_000);
}

const puedeCompartirArchivos = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export default function ExportarHoja({ abierto, filtros, onCerrar }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const avisar = useAviso();
  const [formato, setFormato] = useState<FormatoExportacion>('pdf');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const hoja = ref.current;
    if (!hoja) return;
    if (abierto && !hoja.open) hoja.showModal();
    if (!abierto && hoja.open) hoja.close();
  }, [abierto]);

  const archivo = useQuery({
    queryKey: ['prediccion', 'exportar', filtros, formato],
    queryFn: () => exportarPrediccion(filtros, formato),
    enabled: abierto,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const compartir = async () => {
    if (!archivo.data) return;
    setEnviando(true);
    const { blob, nombre } = archivo.data;
    const adjunto = new File([blob], nombre, { type: blob.type });
    try {
      if (puedeCompartirArchivos() && navigator.canShare?.({ files: [adjunto] })) {
        try {
          await navigator.share({
            files: [adjunto],
            title: 'Predicción de compra',
            text: 'Lista de compra de la semana',
          });
          avisar('Lista compartida');
          onCerrar();
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
      descargar(blob, nombre);
      avisar(
        'Este navegador no puede abrir el menú de compartir, así que se descargó el archivo en tu teléfono.',
      );
      onCerrar();
    } finally {
      setEnviando(false);
    }
  };

  const fallo =
    archivo.error instanceof ApiError
      ? archivo.error.message
      : 'No pudimos preparar el archivo. Intenta de nuevo.';
  const preparando = archivo.isPending || archivo.isFetching;

  return (
    <dialog
      ref={ref}
      className="hoja"
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
    >
      <div className="hoja-asa" aria-hidden="true" />
      <h2 id={idTitulo}>Exportar lista de predicción</h2>
      <fieldset className="hoja-formatos">
        <legend className="sr-only">Formato del archivo</legend>
        {FORMATOS.map(({ id, etiqueta, Icono }) => (
          <label key={id} className="hoja-formato">
            <input
              type="radio"
              name="formato"
              value={id}
              checked={formato === id}
              onChange={() => setFormato(id)}
            />
            <span className="hoja-formato-caja">
              <Icono size={26} weight="bold" aria-hidden="true" />
              {etiqueta}
            </span>
          </label>
        ))}
      </fieldset>
      {archivo.isError && (
        <div className="notice notice-error" role="alert">
          <WarningCircle size={18} weight="bold" aria-hidden="true" />
          <div>
            {fallo}{' '}
            <button type="button" className="enlace" onClick={() => void archivo.refetch()}>
              Intentar de nuevo
            </button>
          </div>
        </div>
      )}
      <Button
        variante="primary"
        bloque
        disabled={preparando || archivo.isError || enviando}
        aria-busy={preparando}
        onClick={() => void compartir()}
      >
        {preparando ? 'Preparando el archivo…' : enviando ? 'Compartiendo…' : 'Compartir'}
      </Button>
      <p className="hoja-nota">
        {puedeCompartirArchivos()
          ? 'Se abrirá el menú de tu teléfono para elegir WhatsApp, Drive, correo o imprimir.'
          : 'Este navegador no puede abrir el menú de compartir: se descargará el archivo.'}
      </p>
      <Button bloque onClick={onCerrar}>
        Cancelar
      </Button>
    </dialog>
  );
}

export function ListSkeleton({ filas = 4 }: { filas?: number }) {
  return (
    <div className="page" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 68 }} />
      ))}
    </div>
  );
}

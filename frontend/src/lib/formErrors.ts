import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './apiClient';

export function aplicarErroresServidor<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  campos: readonly string[],
): string | null {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado. Intenta de nuevo.';
  let asignado = false;
  for (const e of error.errors) {
    if (campos.includes(e.field)) {
      setError(e.field as Path<T>, { type: 'server', message: e.message });
      asignado = true;
    }
  }
  return asignado ? null : error.message;
}

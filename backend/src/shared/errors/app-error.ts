export interface DetalleCampo {
  field: string;
  code: string;
  message: string;
}

export interface OpcionesError {
  detail?: string;
  errors?: DetalleCampo[];
  headers?: Record<string, string>;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: DetalleCampo[] | undefined;
  readonly headers: Record<string, string> | undefined;

  constructor(status: number, code: string, title: string, opciones: OpcionesError = {}) {
    super(title);
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = opciones.detail;
    this.errors = opciones.errors;
    this.headers = opciones.headers;
  }
}

export const noAutenticado = (detail = 'Inicia sesión para continuar.') =>
  new AppError(401, 'UNAUTHENTICATED', 'No autenticado', { detail });

export const noEncontrado = (detail = 'No se encontró el recurso.') =>
  new AppError(404, 'NOT_FOUND', 'No encontrado', { detail });

export const validacion = (errors: DetalleCampo[], detail = 'Revisa los campos marcados.') =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', { detail, errors });

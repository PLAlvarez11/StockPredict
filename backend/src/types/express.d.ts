declare global {
  namespace Express {
    interface Request {
      usuarioId?: number;
    }
  }
}

export {};

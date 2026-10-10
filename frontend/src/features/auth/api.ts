import { api } from '../../lib/apiClient';

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
}

export const authApi = {
  perfil: () => api<Usuario>('GET', '/auth/me'),
  login: (datos: { correo: string; contrasena: string }) =>
    api<{ usuario: Usuario }>('POST', '/auth/login', datos),
  registro: (datos: { nombre: string; correo: string; contrasena: string }) =>
    api<{ usuario: Usuario }>('POST', '/auth/registro', datos),
  logout: () => api<void>('POST', '/auth/logout'),
  recuperar: (datos: { correo: string }) =>
    api<{ mensaje: string }>('POST', '/auth/recuperar', datos),
  restablecer: (datos: { token: string; contrasena: string }) =>
    api<void>('POST', '/auth/restablecer', datos),
};

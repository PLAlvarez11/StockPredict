import { prisma } from '../../shared/db/prisma.js';

export const authRepository = {
  buscarPorCorreo: (correo: string) => prisma.usuario.findUnique({ where: { correo } }),

  buscarPorId: (id: number) => prisma.usuario.findUnique({ where: { id } }),

  crearUsuario: (datos: { nombre: string; correo: string; contrasenaHash: string }) =>
    prisma.usuario.create({ data: datos }),

  invalidarTokens: (usuarioId: number) =>
    prisma.tokenRecuperacion.updateMany({
      where: { usuarioId, usadoEn: null },
      data: { usadoEn: new Date() },
    }),

  crearToken: (datos: { usuarioId: number; tokenHash: string; expiraEn: Date }) =>
    prisma.tokenRecuperacion.create({ data: datos }),

  buscarToken: (tokenHash: string) => prisma.tokenRecuperacion.findUnique({ where: { tokenHash } }),

  consumirToken: (tokenId: number, usuarioId: number, contrasenaHash: string) =>
    prisma.$transaction(async (tx) => {
      const ahora = new Date();
      const marcado = await tx.tokenRecuperacion.updateMany({
        where: { id: tokenId, usadoEn: null, expiraEn: { gt: ahora } },
        data: { usadoEn: ahora },
      });
      if (marcado.count !== 1) return false;
      await tx.usuario.update({ where: { id: usuarioId }, data: { contrasenaHash } });
      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: ahora },
      });
      return true;
    }),
};

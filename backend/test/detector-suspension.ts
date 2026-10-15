import { vigilarBucle } from '../src/shared/vigilancia.js';

vigilarBucle({
  alDetectar: (retrasoMs) => {
    process.stderr.write(
      `\n[detector] el proceso de pruebas estuvo detenido ${Math.round(retrasoMs / 1000)} s (suspensión del equipo o bloqueo del bucle de eventos); una prueba lenta en este momento no es un fallo de consultas\n`,
    );
  },
});

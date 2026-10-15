import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ApiError } from '../../lib/apiClient';
import { CLAVE_CATEGORIAS } from '../categorias/hooks';
import { CLAVE_SUBCATEGORIAS } from '../subcategorias/hooks';
import { productosApi, type Producto } from './api';
import { CLAVE_PRODUCTOS } from './hooks';

type Objetivo = Pick<Producto, 'id' | 'nombre' | 'stock'>;

interface Resultado {
  pedirDesactivar: (producto: Objetivo) => void;
  pedirActivar: (producto: Objetivo) => void;
  dialogos: ReactNode;
}

export function useCambioEstado(alAvisar: (texto: string) => void): Resultado {
  const cliente = useQueryClient();
  const [candidato, setCandidato] = useState<Objetivo | null>(null);
  const [aActivar, setAActivar] = useState<Objetivo | null>(null);
  const [fallo, setFallo] = useState<{ titulo: string; texto: string } | null>(null);

  const refrescar = async () => {
    await cliente.invalidateQueries({ queryKey: CLAVE_PRODUCTOS });
    await cliente.invalidateQueries({ queryKey: CLAVE_CATEGORIAS });
    await cliente.invalidateQueries({ queryKey: CLAVE_SUBCATEGORIAS });
    await cliente.invalidateQueries({ queryKey: ['prediccion'] });
  };

  const inactivar = useMutation({
    mutationFn: (id: number) => productosApi.inactivar(id),
    onSuccess: async () => {
      await refrescar();
      setCandidato(null);
      alAvisar('Producto desactivado');
    },
    onError: (error) => {
      setCandidato(null);
      setFallo({
        titulo: 'No se pudo desactivar',
        texto: error instanceof ApiError ? error.message : 'No se pudo desactivar el producto.',
      });
    },
  });

  const activar = useMutation({
    mutationFn: (id: number) => productosApi.activar(id),
    onSuccess: async () => {
      await refrescar();
      setAActivar(null);
      alAvisar('Producto activado');
    },
    onError: (error) => {
      setAActivar(null);
      setFallo({
        titulo: 'No se pudo activar',
        texto: error instanceof ApiError ? error.message : 'No se pudo activar el producto.',
      });
    },
  });

  const dialogos = (
    <>
      <Dialog
        abierto={candidato !== null}
        titulo={`¿Desactivar «${candidato?.nombre ?? ''}»?`}
        onCerrar={() => setCandidato(null)}
        acciones={
          <>
            <Button onClick={() => setCandidato(null)}>Cancelar</Button>
            <Button
              variante="danger"
              disabled={inactivar.isPending}
              onClick={() => candidato && inactivar.mutate(candidato.id)}
            >
              Desactivar
            </Button>
          </>
        }
      >
        Dejará de aparecer en las listas, en las ventas, en el conteo de stock bajo y en la
        predicción. Podrás activarlo de nuevo.
      </Dialog>

      <Dialog
        abierto={aActivar !== null}
        titulo={`¿Activar «${aActivar?.nombre ?? ''}»?`}
        onCerrar={() => setAActivar(null)}
        acciones={
          <>
            <Button onClick={() => setAActivar(null)}>Cancelar</Button>
            <Button
              variante="primary"
              disabled={activar.isPending}
              onClick={() => aActivar && activar.mutate(aActivar.id)}
            >
              Activar
            </Button>
          </>
        }
      >
        Volverá a aparecer en las listas, en las ventas y en la predicción, con su stock actual de{' '}
        {aActivar?.stock} u.
      </Dialog>

      <Dialog
        abierto={fallo !== null}
        titulo={fallo?.titulo ?? ''}
        onCerrar={() => setFallo(null)}
        acciones={
          <Button variante="primary" onClick={() => setFallo(null)}>
            Entendido
          </Button>
        }
      >
        {fallo?.texto}
      </Dialog>
    </>
  );

  return { pedirDesactivar: setCandidato, pedirActivar: setAActivar, dialogos };
}

import { Hourglass } from '@phosphor-icons/react';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScreenHeader } from '../../components/layout/ScreenHeader';

interface Props {
  titulo: string;
}

export function Proximamente({ titulo }: Props) {
  return (
    <>
      <ScreenHeader titulo={titulo} />
      <EmptyState
        icono={<Hourglass size={26} weight="bold" />}
        titulo="Próximamente"
        texto="Esta pantalla se construye en una de las siguientes etapas."
      />
    </>
  );
}

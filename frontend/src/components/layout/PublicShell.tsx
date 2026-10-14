import { Outlet } from 'react-router-dom';
import { useCambioDeRuta } from '../../lib/useCambioDeRuta';

export function PublicShell() {
  const zona = useCambioDeRuta();
  return (
    <div className="app">
      <main ref={zona} tabIndex={-1} className="app-scroll">
        <Outlet />
      </main>
    </div>
  );
}

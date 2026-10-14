import { Outlet } from 'react-router-dom';
import { useCambioDeRuta } from '../../lib/useCambioDeRuta';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const zona = useCambioDeRuta();
  return (
    <div className="app">
      <main ref={zona} tabIndex={-1} className="app-scroll">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

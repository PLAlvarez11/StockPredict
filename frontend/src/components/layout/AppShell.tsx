import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

export function AppShell() {
  return (
    <div className="app">
      <main className="app-scroll">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

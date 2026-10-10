import { Outlet } from 'react-router-dom';

export function PublicShell() {
  return (
    <div className="app">
      <main className="app-scroll">
        <Outlet />
      </main>
    </div>
  );
}

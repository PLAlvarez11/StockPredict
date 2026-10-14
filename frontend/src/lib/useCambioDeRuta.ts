import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function useCambioDeRuta() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const anterior = useRef(pathname);

  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;
    const zona = ref.current;
    if (!zona) return;
    zona.scrollTop = 0;
    zona.focus({ preventScroll: true });
  }, [pathname]);

  return ref;
}

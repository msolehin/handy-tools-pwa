import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const scrollPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current[pathname] = window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === '/') {
      const savedPosition = scrollPositions.current['/'] || 0;
      // Timeout ensures the DOM has updated before we attempt to scroll
      setTimeout(() => {
        window.scrollTo(0, savedPosition);
      }, 10);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}

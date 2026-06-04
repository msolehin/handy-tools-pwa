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
    const scrollContainer = document.getElementById('main-scroll-area');
    
    const handleScroll = () => {
      // Save scroll position from either the internal desktop container or the window (mobile)
      scrollPositions.current[pathname] = scrollContainer?.scrollTop || window.scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [pathname]);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-area');
    
    if (pathname === '/') {
      const savedPosition = scrollPositions.current['/'] || 0;
      // Timeout ensures the DOM has updated before we attempt to scroll
      setTimeout(() => {
        window.scrollTo(0, savedPosition);
        if (scrollContainer) scrollContainer.scrollTo({ top: savedPosition, behavior: 'instant' });
      }, 10);
    } else {
      window.scrollTo(0, 0);
      if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname]);

  return null;
}

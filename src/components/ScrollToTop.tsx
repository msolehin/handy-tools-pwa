import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const positions = useRef<Record<string, number>>({});
  // The path currently shown. Updated in a layout effect so it's correct BEFORE the
  // browser fires the post-navigation "clamp" scroll event (see below).
  const currentPath = useRef(pathname);

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Attach the scroll listener ONCE and always save under the active path. When you
  // navigate to a shorter page, the persistent #main-scroll-area clamps its scrollTop
  // and fires a scroll event after paint. Because currentPath is already updated (in the
  // layout effect), that clamp is saved under the NEW route — the previous route's saved
  // position is never overwritten.
  useEffect(() => {
    const handleScroll = () => {
      const c = document.getElementById('main-scroll-area');
      positions.current[currentPath.current] = c?.scrollTop || window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    const container = document.getElementById('main-scroll-area');
    container?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      container?.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Runs during commit (before paint / before the clamp scroll event) so the listener
  // attributes any post-nav scroll to the route we're entering.
  useLayoutEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const scrollContainer = document.getElementById('main-scroll-area');

    if (pathname === '/') {
      const target = positions.current['/'] || 0;
      if (target <= 0) return;

      let frame = 0;
      let rafId = 0;
      let aborted = false;
      const abort = () => { aborted = true; };
      // If the user starts scrolling themselves, stop trying to restore.
      window.addEventListener('wheel', abort, { passive: true });
      window.addEventListener('touchmove', abort, { passive: true });
      window.addEventListener('keydown', abort);

      // Retry across frames until we actually land on the saved position — the Home list
      // can take a couple of frames to lay out when returning from heavier tools.
      const restore = () => {
        if (aborted) return;
        window.scrollTo(0, target);
        if (scrollContainer) scrollContainer.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });

        const current = Math.max(window.scrollY, scrollContainer ? scrollContainer.scrollTop : 0);
        frame++;
        if (current < target - 2 && frame < 60) rafId = requestAnimationFrame(restore);
      };
      rafId = requestAnimationFrame(restore);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener('wheel', abort);
        window.removeEventListener('touchmove', abort);
        window.removeEventListener('keydown', abort);
      };
    } else {
      window.scrollTo(0, 0);
      if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [pathname]);

  return null;
}

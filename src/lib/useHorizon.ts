import { useEffect, useState } from 'react';
import { readHorizon, type HorizonItem } from './horizon';

/**
 * Everything still ahead, re-read whenever any tool writes.
 *
 * Lives apart from the list component so that file exports components only — mixing a hook in
 * breaks fast refresh for the whole module.
 */
export function useHorizon(): HorizonItem[] {
  const [items, setItems] = useState<HorizonItem[]>([]);

  // The panel sits beside the tool you are editing, so a record saved on the left has to appear
  // on the right without a reload. The sheet on mobile gets the same freshness for free.
  useEffect(() => {
    const refresh = () => setItems(readHorizon());
    refresh();
    window.addEventListener('store:changed', refresh);
    return () => window.removeEventListener('store:changed', refresh);
  }, []);

  return items;
}

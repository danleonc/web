import { useEffect, useRef } from "react";

/** Keeps the browser Back button and the in-app Back button in sync. */
export function useConversationNavigation(section: string, close: () => void) {
  const closeRef = useRef(close);
  const trigger = useRef<HTMLElement | null>(null);
  closeRef.current = close;
  useEffect(() => {
    function onPop(event: PopStateEvent) {
      if (event.state?.nexafiaConversation !== section) {
        closeRef.current();
        requestAnimationFrame(() => trigger.current?.focus());
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [section]);
  function enter() {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (history.state?.nexafiaConversation !== section)
      history.pushState({ ...history.state, nexafiaConversation: section }, "", location.href);
  }
  function back() {
    if (history.state?.nexafiaConversation === section) history.back();
    else { closeRef.current(); requestAnimationFrame(() => trigger.current?.focus()); }
  }
  return { enter, back };
}

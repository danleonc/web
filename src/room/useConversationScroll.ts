import { useEffect, useRef, useState } from "react";

// Follow messages only while reading the latest ones; never move the page.
export function useConversationScroll(lastId?: string, own = false) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [unread, setUnread] = useState(false);
  function goToLatest() {
    const viewport = ref.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "instant" });
    following.current = true;
    setUnread(false);
  }
  useEffect(() => {
    if (!lastId) {
      following.current = true;
      setUnread(false);
      return;
    }
    if (following.current || own) goToLatest();
    else setUnread(true);
  }, [lastId]);
  return {
    ref,
    unread,
    goToLatest,
    onScroll: () => {
      const viewport = ref.current;
      if (!viewport) return;
      following.current =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 64;
      if (following.current) setUnread(false);
    },
  };
}

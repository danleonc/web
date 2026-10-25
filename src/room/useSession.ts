import { isPlazaPersonBlocked } from "../plaza/data";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { Activity } from "../data";
import { createSession, sessionReducer } from "./engine";
import type { SessionEvent } from "./engine";
export function useSession(
  activity: Activity,
  alias: string,
  blocked: string[],
  expelled: string[] = [],
) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () =>
    createSession(
      activity.people.filter((n) => !isPlazaPersonBlocked(n, blocked)),
      alias,
      activity.minimum,
      activity.capacity,
      activity.duration,
      activity.questions.length,
      Date.now(),
    ),
  );
  const [now, setNow] = useState(Date.now);
  const send = useCallback(
    (event: SessionEvent) => {
      if (
        event.type === "presence" &&
        event.present &&
        expelled.includes(event.id)
      )
        return;
      setNow(event.now);
      dispatch(event);
    },
    [expelled],
  );
  useEffect(() => {
    if (session.phase === "closed" || session.phase === "insufficient") return;
    const tick = () => {
      const time = Date.now();
      setNow(time);
      dispatch({ type: "tick", now: time });
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session.phase]);
  useEffect(() => {
    for (const p of session.participants)
      if (
        !p.own &&
        p.present &&
        (isPlazaPersonBlocked(p.name, blocked) || expelled.includes(p.id))
      )
        dispatch({
          type: "presence",
          id: p.id,
          present: false,
          now: Date.now(),
        });
  }, [blocked, activity.id, session.participants, expelled]);
  return { session, dispatch: send, now };
}

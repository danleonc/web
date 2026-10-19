import { useCallback, useEffect, useReducer, useState } from "react";
import type { Activity } from "../data";
import { createSession, sessionReducer } from "./engine";
import type { SessionEvent } from "./engine";
export function useSession(
  activity: Activity,
  alias: string,
  blocked: string[],
) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () =>
    createSession(
      activity.people.filter((n) => !blocked.includes(`${activity.id}:${n}`)),
      alias,
      activity.minimum,
      activity.capacity,
      activity.duration,
      activity.questions.length,
      Date.now(),
    ),
  );
  const [now, setNow] = useState(Date.now);
  const send = useCallback((event: SessionEvent) => {
    setNow(event.now);
    dispatch(event);
  }, []);
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
      if (!p.own && p.present && blocked.includes(`${activity.id}:${p.name}`))
        dispatch({
          type: "presence",
          id: p.id,
          present: false,
          now: Date.now(),
        });
  }, [blocked, activity.id, session.participants]);
  return { session, dispatch: send, now };
}

import { useCallback, useEffect, useRef, useState } from "react";

const SEEN_KEY = "agentchat:welcome:v1";

export function useWelcomeDemo() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const timer = useRef<number | null>(null);
  const cancelTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      // The tour still works when browser storage is unavailable.
    }
    timer.current = window.setTimeout(() => setOpen(true), 900);
    return cancelTimer;
  }, [cancelTimer]);
  const show = useCallback(() => {
    cancelTimer();
    setSession((value) => value + 1);
    setOpen(true);
  }, [cancelTimer]);
  const close = useCallback(() => {
    cancelTimer();
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "seen");
    } catch {
      // Dismissal must never depend on storage permissions.
    }
  }, [cancelTimer]);
  return { open, session, show, close };
}

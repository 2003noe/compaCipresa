import { useCallback, useEffect, useRef, useState } from "react";

// Compte à rebours en secondes (ex. délai avant de pouvoir renvoyer un code).
// const [secondes, demarrer] = useCountdown(60);
export default function useCountdown(initial = 60) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef(null);

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  };

  const start = useCallback((seconds = initial) => {
    stop();
    setRemaining(seconds);
    timer.current = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          stop();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }, [initial]);

  useEffect(() => stop, []);

  return [remaining, start];
}

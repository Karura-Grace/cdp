"use client";
// Scroll-in helpers for the public site. Content is in the server HTML; below the fold a Scene waits hidden, then plays once
// (cdp.css, [data-scene] rules). People who prefer reduced motion get everything shown at once.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

type Phase = "ssr" | "hidden" | "shown";

export function Scene({ children, className, style, id, role, "aria-label": label, onPointerMove, onPointerOut }: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  role?: string;
  "aria-label"?: string;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerOut?: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("ssr");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined" || el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      setPhase("shown");
      return;
    }
    setPhase("hidden");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} id={id} role={role} aria-label={label} data-scene={phase} className={className} style={style} onPointerMove={onPointerMove} onPointerOut={onPointerOut}>
      {children}
    </div>
  );
}

// The four orientation cards: tilt a few degrees under the cursor with a soft glow in the card's colour (desktop mouse only).
export function TiltGrid({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const card = (e: PointerEvent<HTMLDivElement>) => (e.target as HTMLElement).closest<HTMLElement>(".ocard");
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = card(e);
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
    if (reduce) return;
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
    el.style.setProperty("--rx", `${(0.5 - (e.clientY - r.top) / r.height) * 8}deg`);
  };
  const out = (e: PointerEvent<HTMLDivElement>) => {
    const el = card(e);
    if (!el || el.contains(e.relatedTarget as Node | null)) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };
  return (
    <Scene className={className} onPointerMove={move} onPointerOut={out}>
      {children}
    </Scene>
  );
}

// A number that counts up from zero the first time it is on screen. The server HTML carries the real number.
export function CountUp({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [v, setV] = useState(n);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, n, { duration: 0.8, ease: [0.2, 0, 0, 1], onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, reduce, n]);
  return <span ref={ref}>{v}</span>;
}

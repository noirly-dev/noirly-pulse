"use client";

import { useEffect, useState } from "react";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function DotMatrixClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState("00:00:00");

  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span className={`matrix-numeral ${className}`}>{time}</span>;
}

export function DotMatrixNumeral({
  children,
  className = "",
}: {
  children: string | number;
  className?: string;
}) {
  return <span className={`matrix-numeral ${className}`}>{children}</span>;
}

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Common row first (ARCHITECTURE §11.8), then a small general set. */
export const PICKER_EMOJI = [
  "👍", "❤️", "😂", "🎉", "👀", "🔥",
  "😊", "😮", "😢", "🙏", "👏", "✅",
  "🚀", "💯", "🤔", "😅", "🙌", "👎",
];

const COLUMNS = 6;

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
};

/**
 * Keyboard grid: roving tabindex, arrow keys move, Enter/Space picks,
 * Escape closes (the caller restores focus to the invoker).
 */
export function EmojiPicker({ onPick, onClose }: Props) {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buttons.current[active]?.focus();
  }, [active]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = PICKER_EMOJI.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive((index) => Math.min(last, Math.max(0, index + moves[event.key])));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(last);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      ref={root}
      role="dialog"
      aria-label="Choose a reaction"
      onKeyDown={onKeyDown}
      className="absolute bottom-6 z-20 grid grid-cols-6 gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-1 shadow"
    >
      {PICKER_EMOJI.map((emoji, index) => (
        <button
          key={emoji}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          tabIndex={index === active ? 0 : -1}
          aria-label={`React ${emoji}`}
          className="size-8 rounded hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          onFocus={() => setActive(index)}
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

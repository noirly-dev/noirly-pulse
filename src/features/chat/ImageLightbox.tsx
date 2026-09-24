"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
      <div className="absolute right-4 top-4 flex gap-2">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="rounded border border-white/30 px-3 py-1 text-sm text-white"
        >
          Open original
        </a>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          className="rounded border border-white/30 px-3 py-1 text-sm text-white"
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CallReaction } from "@/src/stores/call-store";

export function ReactionBurst({ reactions }: { reactions: CallReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      <AnimatePresence>
        {reactions.map((row, index) => (
          <motion.span
            key={row.id}
            className="absolute bottom-28 left-1/2 text-3xl"
            style={{ marginLeft: ((index % 5) - 2) * 28 }}
            initial={{ y: 24, opacity: 1 }}
            animate={{ y: -48, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.2, ease: "easeOut" }}
          >
            {row.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

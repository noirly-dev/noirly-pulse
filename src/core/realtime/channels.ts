import type { ChannelName } from "@noirly-dev/realtime-shared";
import { assertChannelName } from "@noirly-dev/realtime-shared";

export const pulseChannel = {
  conv: (id: string) => assertChannelName(`conv:${id}`),
  typing: (id: string) => assertChannelName(`ty:${id}`),
  workspace: (id: string) => assertChannelName(`ws:${id}`),
  inbox: (userId: string) => assertChannelName(`inbox:${userId}`),
  call: (callId: string) => assertChannelName(`call:${callId}`),
} as const;

export type PulseChannelName = ChannelName;

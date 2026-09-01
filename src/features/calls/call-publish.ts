type CallPublisher = (event: string, data: Record<string, unknown>) => void;

let publisher: CallPublisher | null = null;

export function setCallEventPublisher(next: CallPublisher | null): void {
  publisher = next;
}

export function publishCallEvent(event: string, data: Record<string, unknown> = {}): void {
  publisher?.(event, data);
}

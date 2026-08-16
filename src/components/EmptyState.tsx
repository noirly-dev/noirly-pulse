type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <div className="flex flex-1 flex-col justify-center px-8 py-16">
      <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted">
        Pulse
      </p>
      <h2 className="text-perforated mt-2 font-display text-5xl font-bold tracking-[-0.05em] uppercase">
        {title}
      </h2>
      <p className="mt-4 max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}

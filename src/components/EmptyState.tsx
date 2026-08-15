type Props = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-16 text-center">
      <h2 className="text-lg font-semibold text-[#F5F5F5]">{title}</h2>
      <p className="max-w-sm text-sm text-[#A3A3A3]">{description}</p>
    </div>
  );
}

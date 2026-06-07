type FieldRendererProps = {
  label: string;
  value: string | number;
};

export function FieldRenderer({ label, value }: FieldRendererProps) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="rounded-md border border-border bg-stone-50 px-3 py-2">{value}</p>
    </div>
  );
}

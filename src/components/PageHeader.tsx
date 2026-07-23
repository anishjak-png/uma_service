export function PageHeader({
  title,
  description,
  compact = false,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
}) {
  if (!title && !description) return null;

  if (compact) {
    return (
      <div className="mb-3">
        {title && (
          <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        )}
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3">
      {title && (
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      )}
      {description && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

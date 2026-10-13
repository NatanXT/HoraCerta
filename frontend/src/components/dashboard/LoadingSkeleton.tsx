export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-label="Carregando dados da jornada">
      {/* Clock Card Skeleton */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-8 text-center space-y-6">
        <div className="w-36 h-6 bg-[var(--hc-surface-raised)] rounded-full mx-auto" />
        <div className="w-56 h-12 bg-[var(--hc-surface-raised)] rounded-xl mx-auto" />
        <div className="w-48 h-12 bg-[var(--hc-surface-raised)] rounded-xl mx-auto" />
      </div>

      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-5 space-y-4">
            <div className="w-28 h-4 bg-[var(--hc-surface-raised)] rounded" />
            <div className="w-24 h-8 bg-[var(--hc-surface-raised)] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Today Entries Skeleton */}
      <div className="bg-[var(--hc-surface)] border border-[var(--hc-border)] rounded-2xl p-6 space-y-4">
        <div className="w-36 h-5 bg-[var(--hc-surface-raised)] rounded" />
        <div className="space-y-3 pt-2">
          <div className="w-full h-10 bg-[var(--hc-surface-raised)] rounded-lg" />
          <div className="w-full h-10 bg-[var(--hc-surface-raised)] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

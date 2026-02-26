export default function TeamLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 skeleton-shimmer rounded w-20" />
        <div className="h-10 skeleton-shimmer rounded-lg w-32" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-2 px-3"
            style={{ paddingLeft: `${(i % 3) * 20 + 12}px` }}
          >
            <div className="w-7 h-7 skeleton-shimmer rounded shrink-0" />
            <div className="w-8 h-8 skeleton-shimmer rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 skeleton-shimmer rounded w-32" />
              <div className="h-3 skeleton-shimmer rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

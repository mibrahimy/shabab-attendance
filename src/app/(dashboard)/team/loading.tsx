export default function TeamLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 skeleton-shimmer rounded w-20" />
        <div className="h-10 skeleton-shimmer rounded-lg w-32" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/80 px-4 py-3 flex gap-4">
          <div className="h-4 skeleton-shimmer rounded w-24" />
          <div className="h-4 skeleton-shimmer rounded w-20 hidden sm:block" />
          <div className="h-4 skeleton-shimmer rounded w-16 hidden md:block" />
          <div className="h-4 skeleton-shimmer rounded w-20 hidden lg:block" />
          <div className="h-4 skeleton-shimmer rounded w-14 hidden sm:block" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center gap-2 flex-1" style={{ paddingLeft: `${(i % 3) * 20}px` }}>
              <div className="w-5 h-5 skeleton-shimmer rounded shrink-0" />
              <div className="w-7 h-7 skeleton-shimmer rounded-full shrink-0" />
              <div className="h-4 skeleton-shimmer rounded w-28" />
            </div>
            <div className="h-4 skeleton-shimmer rounded w-20 hidden sm:block" />
            <div className="h-4 skeleton-shimmer rounded w-16 hidden md:block" />
            <div className="h-4 skeleton-shimmer rounded w-24 hidden lg:block" />
            <div className="h-5 skeleton-shimmer rounded-full w-16 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

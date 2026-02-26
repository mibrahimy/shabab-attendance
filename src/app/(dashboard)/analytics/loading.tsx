export default function AnalyticsLoading() {
  return (
    <div>
      <div className="h-7 skeleton-shimmer rounded w-28 mb-6" />

      <div className="flex gap-2 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 skeleton-shimmer rounded-lg w-20" />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="h-5 skeleton-shimmer rounded w-40 mb-4" />
          <div className="h-64 skeleton-shimmer rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="h-5 skeleton-shimmer rounded w-40 mb-4" />
          <div className="h-64 skeleton-shimmer rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function TeamLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 bg-gray-200 rounded animate-pulse w-20" />
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-32" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-2 px-3"
            style={{ paddingLeft: `${(i % 3) * 20 + 12}px` }}
          >
            <div className="w-7 h-7 bg-gray-200 rounded animate-pulse shrink-0" />
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

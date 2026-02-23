interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = "" }: SkeletonProps) {
  return (
    <div className={`h-4 bg-gray-200 rounded animate-pulse ${className}`} />
  );
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 space-y-3 ${className}`}>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
      <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className = "" }: SkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <div className="border-b border-gray-200 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded animate-pulse flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-gray-100 last:border-0 px-4 py-3 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-gray-200 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

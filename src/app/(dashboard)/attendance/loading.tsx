import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AttendanceLoading() {
  return (
    <div>
      <div className="h-7 skeleton-shimmer rounded w-28 mb-6" />

      <div className="h-10 skeleton-shimmer rounded-lg w-full max-w-xs mb-6" />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 skeleton-shimmer rounded-full shrink-0" />
            <SkeletonLine className="flex-1 w-32" />
            <div className="w-20 h-8 skeleton-shimmer rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

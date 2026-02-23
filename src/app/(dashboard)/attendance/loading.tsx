import { SkeletonLine } from "@/components/ui/Skeleton";

export default function AttendanceLoading() {
  return (
    <div>
      <div className="h-7 bg-gray-200 rounded animate-pulse w-28 mb-6" />

      <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-full max-w-xs mb-6" />

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse shrink-0" />
            <SkeletonLine className="flex-1 w-32" />
            <div className="w-20 h-8 bg-gray-200 rounded-lg animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { SkeletonLine } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-7 bg-gray-200 rounded animate-pulse w-32 mb-6" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
              <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse" />
            </div>
            <div className="h-6 bg-gray-200 rounded animate-pulse w-16" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SkeletonLine className="w-36 mb-4 h-5" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1.5 flex-1">
                  <SkeletonLine className="w-40" />
                  <SkeletonLine className="w-28 h-3" />
                </div>
                <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <SkeletonLine className="w-36 mb-4 h-5" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1.5 flex-1">
                  <SkeletonLine className="w-32" />
                  <SkeletonLine className="w-24 h-3" />
                </div>
                <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

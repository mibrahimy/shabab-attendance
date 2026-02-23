import { SkeletonCard } from "@/components/ui/Skeleton";

export default function EventsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 bg-gray-200 rounded animate-pulse w-24" />
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-32" />
      </div>

      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 rounded-lg animate-pulse w-20" />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

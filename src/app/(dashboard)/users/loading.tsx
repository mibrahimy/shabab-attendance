import { SkeletonTable } from "@/components/ui/Skeleton";

export default function UsersLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 skeleton-shimmer rounded w-20" />
        <div className="h-10 skeleton-shimmer rounded-lg w-28" />
      </div>

      <div className="h-10 skeleton-shimmer rounded-lg mb-4" />

      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

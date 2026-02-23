import { SkeletonTable } from "@/components/ui/Skeleton";

export default function UsersLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 bg-gray-200 rounded animate-pulse w-20" />
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-28" />
      </div>

      <div className="h-10 bg-gray-200 rounded-lg animate-pulse mb-4" />

      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}

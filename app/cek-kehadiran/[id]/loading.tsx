import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8FAFA] p-4 lg:p-6">
      <div className="mx-auto max-w-4xl">
        <TableSkeleton columns={4} rows={8} />
      </div>
    </div>
  );
}
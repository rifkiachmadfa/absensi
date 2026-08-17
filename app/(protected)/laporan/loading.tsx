import { TableSkeleton } from "@/components/skeletons/table-skeleton";

export default function Loading() {
  return <TableSkeleton columns={8} rows={10} />;
}
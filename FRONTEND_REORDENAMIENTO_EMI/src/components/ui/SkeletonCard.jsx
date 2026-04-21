function SkeletonCard() {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-[16/10] animate-pulse bg-gray-100" />
      <div className="space-y-4 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
        <div className="h-5 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    </article>
  );
}

export default SkeletonCard;
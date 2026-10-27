// Fallback for staff pages. Each page wraps its session-dependent content in
// <Suspense fallback={<PageSkeleton />}> inside the page itself: a boundary in
// a shared layout doesn't cover client navigations between sibling pages.
export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-64 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

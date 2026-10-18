export function isNearBottom(top: number, height: number, viewport: number) {
  return height - top - viewport <= 80;
}

export function shouldFollowTail(previous: string | null, next: string | null, pinned: boolean) {
  return next !== null && previous !== next && (previous === null || pinned);
}
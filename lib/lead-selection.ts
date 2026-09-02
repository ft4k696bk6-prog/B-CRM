export function selectLeadRange(
  visibleIds: string[],
  anchorId: string | null,
  size: number,
  currentSelection: string[] = []
) {
  if (!anchorId || size <= 0) return currentSelection;
  const anchorIndex = visibleIds.indexOf(anchorId);
  if (anchorIndex < 0) return currentSelection;

  const rangeIds = visibleIds.slice(anchorIndex, anchorIndex + size);
  return [...new Set([...currentSelection, ...rangeIds])];
}

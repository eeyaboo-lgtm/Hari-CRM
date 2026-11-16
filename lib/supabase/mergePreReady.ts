// Three-way merge for an edit made BEFORE the initial Supabase fetch resolved.
//
// Why (2026-11-15): the pre-ready edit (`pendingWrite`) is built off the
// localStorage CACHE, not off the server. The old code let it replace the
// server rows wholesale, so the follow-up sync diffed "stale cache + my edit"
// against the server and DELETED any row another device/household member had
// added since this device last cached (and overwrote their edits with stale
// values). Using the cache as the common ancestor fixes that:
//
//   base   = cached rows this device painted from
//   local  = pendingWrite (base + whatever the user just did)
//   server = freshly fetched rows (source of truth)
//
//  - row I didn't touch            -> take the server's version
//  - row I edited                  -> keep my version (sync will UPDATE it)
//  - row I added                   -> keep it (sync will INSERT it)
//  - row I deleted                 -> stays out (sync will DELETE it)
//  - row added elsewhere           -> keep the server's row (was being deleted)
//  - row deleted elsewhere         -> drop it, unless I edited it or it is a
//                                     known unsaved (`pendingIds`) item
export function mergePreReadyEdit<T extends { id: string }>(
  base: T[],
  local: T[],
  server: T[],
  pendingIds: Set<string> = new Set()
): T[] {
  const baseById = new Map(base.map((r) => [r.id, r]));
  const serverById = new Map(server.map((r) => [r.id, r]));
  const localIds = new Set(local.map((r) => r.id));
  const same = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

  const merged: T[] = [];
  for (const item of local) {
    const b = baseById.get(item.id);
    const s = serverById.get(item.id);
    if (!b) {
      merged.push(item); // added locally just now
    } else if (same(item, b)) {
      // untouched locally: server wins; gone from server = deleted elsewhere
      if (s) merged.push(s);
      else if (pendingIds.has(item.id)) merged.push(item);
    } else {
      merged.push(item); // edited locally
    }
  }
  // Rows that exist on the server but this device had never cached.
  for (const s of server) {
    if (!baseById.has(s.id) && !localIds.has(s.id)) merged.push(s);
  }
  return merged;
}

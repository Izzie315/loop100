import { supabase } from "@/integrations/supabase/client";

// Shared cache + batching so a conversation asks for all attachment links in one request.
const cache = new Map<string, { url: string; expires: number }>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = new Map(waiting);
  waiting.clear();
  const paths = [...batch.keys()];
  let results: { path: string | null; signedUrl: string | null }[] = [];
  try {
    const { data } = await supabase.storage.from("note-media").createSignedUrls(paths, 3600);
    results = (data ?? []) as typeof results;
  } catch { /* handled below */ }
  const found = new Map(results.filter((r) => r.path && r.signedUrl).map((r) => [r.path as string, r.signedUrl as string]));
  for (const [path, resolvers] of batch) {
    const url = found.get(path) ?? null;
    if (url) cache.set(path, { url, expires: Date.now() + 50 * 60 * 1000 });
    resolvers.forEach((r) => r(url));
  }
}

export function cachedMediaUrl(path: string) {
  const hit = cache.get(path);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

export function signedMediaUrl(path: string, fresh = false): Promise<string | null> {
  if (fresh) cache.delete(path);
  const hit = cachedMediaUrl(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    waiting.set(path, [...(waiting.get(path) ?? []), resolve]);
    timer ??= setTimeout(() => void flush(), 30);
  });
}

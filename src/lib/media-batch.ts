export type Attachment = {
  file: File;
  kind: "photo" | "video" | "voice";
  seconds?: number;
};

export async function uploadAttachments(
  attached: Attachment[],
  ownerId: string,
  prepare: (file: File) => Promise<File>,
  upload: (path: string, file: File, progress: (value: number) => void) => Promise<void>,
  remove: (paths: string[]) => Promise<unknown>,
  progress: (value: number) => void,
) {
  const completed: { path: string; kind: string; seconds: number | null }[] = [];
  let attempted: string | undefined;
  try {
    // One large transfer at a time avoids exhausting mobile memory or bandwidth.
    for (const [index, item] of attached.entries()) {
      const file = await prepare(item.file);
      const ext = file.name.split(".").pop() || "bin";
      attempted = `${ownerId}/${crypto.randomUUID()}.${ext}`;
      await upload(attempted, file, (value) =>
        progress(Math.round((index * 100 + value) / attached.length)),
      );
      completed.push({ path: attempted, kind: item.kind, seconds: item.seconds ?? null });
      attempted = undefined;
    }
    return completed;
  } catch (error) {
    const paths = completed.map((item) => item.path);
    if (attempted) paths.push(attempted);
    if (paths.length) await remove(paths).catch(() => undefined);
    throw error;
  }
}
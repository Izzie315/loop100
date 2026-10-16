import { supabase } from "@/integrations/supabase/client";
import { mediaFormat } from "./media-format";

export async function prepareMedia(original: File): Promise<File> {
  const { mime } = mediaFormat(original);
  if (mime === "image/heic" || mime === "image/heif") {
    const { heicTo } = await import("heic-to");
    const converted = await heicTo({ blob: original, type: "image/jpeg", quality: 0.9 });
    return new File([converted], original.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  }
  return original.type === mime ? original : new File([original], original.name, { type: mime });
}

export async function uploadMedia(path: string, file: File, progress: (value: number) => void) {
  if (file.size < 6 * 1024 * 1024) {
    const { error } = await supabase.storage.from("note-media").upload(path, file, {
      contentType: file.type, upsert: false, cacheControl: "3600",
    });
    if (error) throw error;
    progress(100);
    return;
  }
  const { Upload } = await import("tus-js-client");
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Please sign in again.");
  const origin = import.meta.env.VITE_SUPABASE_URL;
  if (!origin) throw new Error("Uploads are unavailable.");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${origin}/storage/v1/upload/resumable`,
      headers: { authorization: `Bearer ${data.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      metadata: { bucketName: "note-media", objectName: path, contentType: file.type, cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      onProgress: (done, total) => progress(Math.round(done / total * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}
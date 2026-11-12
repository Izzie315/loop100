const mimeByExtension: Record<string, string> = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/mp4", webm: "video/webm",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif", avif: "image/avif",
  m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
};
export function mediaFormat(file: Pick<File, "name" | "type">) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.startsWith("audio/") ? file.type : mimeByExtension[extension] ?? file.type;
  return { mime, kind: mime.startsWith("video/") ? "video" as const : "photo" as const };
}
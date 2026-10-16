import { describe, expect, test } from "bun:test";
import { appearanceOf, initialEntry } from "./appearance";
import { mediaFormat } from "./media-format";

describe("entry preferences", () => {
  test("first setup is light", () => expect(appearanceOf(null)).toBe("light"));
  test("saved dark choice is preserved", () => expect(appearanceOf("dark")).toBe("dark"));
  test("entry opens sign in", () => expect(initialEntry).toBe("signin"));
});
describe("cross-device attachments", () => {
  test("recognizes an iPhone video with no MIME", () => expect(mediaFormat({ name: "IMG.MOV", type: "" })).toEqual({ mime: "video/quicktime", kind: "video" }));
  test("recognizes MP4 with generic MIME", () => expect(mediaFormat({ name: "clip.mp4", type: "application/octet-stream" }).kind).toBe("video"));
  test("recognizes iPhone photos for conversion", () => expect(mediaFormat({ name: "IMG.HEIC", type: "" }).mime).toBe("image/heic"));
});
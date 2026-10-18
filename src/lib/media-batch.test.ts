import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { uploadAttachments } from "./media-batch";
import { mediaFormat } from "./media-format";
import { isNearBottom, shouldFollowTail } from "./note-scroll";

describe("attachment delivery", () => {
  it("normalizes every photo and preserves order with one transfer at a time", async () => {
    let running = 0;
    let maximum = 0;
    const prepared: string[] = [];
    const uploaded: string[] = [];
    const result = await uploadAttachments(
      ["first", "second", "third"].map((name) => ({ file: new File([name], `${name}.heic`), kind: "photo" as const })),
      "account",
      async (file) => {
        prepared.push(file.name);
        return new File([await file.arrayBuffer()], file.name.replace(".heic", ".jpg"), { type: "image/jpeg" });
      },
      async (_path, file, progress) => {
        running += 1;
        maximum = Math.max(maximum, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        uploaded.push(file.name);
        progress(100);
        running -= 1;
      },
      async () => assert.fail("successful batch must not remove files"),
      () => undefined,
    );
    assert.equal(maximum, 1);
    assert.deepEqual(prepared, ["first.heic", "second.heic", "third.heic"]);
    assert.deepEqual(uploaded, ["first.jpg", "second.jpg", "third.jpg"]);
    assert.equal(result.length, 3);
    assert.ok(result.every((item) => item.path.endsWith(".jpg")));
  });

  it("delivers every video in order and reports complete progress", async () => {
    const values: number[] = [];
    const result = await uploadAttachments(
      ["one.mp4", "two.mov"].map((name) => ({ file: new File([name], name), kind: "video" as const })),
      "account", async (file) => file,
      async (_path, _file, progress) => progress(100),
      async () => undefined, (value) => values.push(value),
    );
    assert.deepEqual(result.map((item) => item.kind), ["video", "video"]);
    assert.deepEqual(values, [50, 100]);
  });

  it("removes partial uploads and rejects the batch on a later failure", async () => {
    const attempts: string[] = [];
    const removed: string[] = [];
    await assert.rejects(uploadAttachments(
      ["one.mp4", "two.mp4"].map((name) => ({ file: new File([name], name), kind: "video" as const })),
      "account", async (file) => file,
      async (path) => { attempts.push(path); if (attempts.length === 2) throw new Error("interrupted"); },
      async (paths) => { removed.push(...paths); }, () => undefined,
    ), /interrupted/);
    assert.deepEqual(removed, attempts);
  });

  it("keeps recorded WebM audio classified as audio", () => {
    assert.equal(mediaFormat({ name: "voice.webm", type: "audio/webm;codecs=opus" }).mime, "audio/webm;codecs=opus");
  });
});

describe("reading position", () => {
  it("does not follow incoming notes while reading older content", () => {
    assert.equal(isNearBottom(200, 1500, 400), false);
    assert.equal(shouldFollowTail("old", "new", false), false);
  });
  it("follows incoming notes only at the bottom", () => {
    assert.equal(isNearBottom(1080, 1500, 400), true);
    assert.equal(shouldFollowTail("old", "new", true), true);
  });
  it("does not reposition on edits, reactions, or deletion of older notes", () => {
    assert.equal(shouldFollowTail("same", "same", true), false);
  });
  it("opens the initial conversation at its newest note", () => {
    assert.equal(shouldFollowTail(null, "latest", true), true);
  });
});
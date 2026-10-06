import { describe, expect, it } from "vitest";
import {
  applyPose,
  closeGap,
  createProject,
  keyframeTimes,
  type MediaClip,
  type MediaItem,
  newMediaClip,
  newTextClip,
  normalizeProject,
  type Project,
  poseAt,
  rippleDelete,
  rippleShift,
  setLink,
  setSpeed,
  sourceTime,
  splitClips,
  toggleKeyframe,
  transitionAlpha,
  transitionMap,
  trimToTime,
  visualWindow,
  withLinked,
} from "./model";

const media = new Map<string, MediaItem>([
  ["m1", { id: "m1", kind: "video", duration: 20, width: 1920, height: 1080, hasAudio: true } as MediaItem],
]);

function project(clips: MediaClip[]): Project {
  const p = createProject();
  const v = p.tracks.find((t) => t.kind === "video")!.id;
  const a = p.tracks.find((t) => t.kind === "audio")!.id;
  return {
    ...p,
    clips: clips.map((c) => ({ ...c, trackId: c.trackId === "V" ? v : c.trackId === "A" ? a : c.trackId })),
  };
}

const clip = (id: string, start: number, duration: number, extra: Partial<MediaClip> = {}) =>
  newMediaClip({ id, trackId: "V", mediaId: "m1", start, duration, ...extra });

const byId = (p: Project, id: string) => p.clips.find((c) => c.id === id)!;

describe("split", () => {
  it("advances the right half's in point by source time, so speed is respected", () => {
    const p = splitClips(project([clip("a", 0, 4, { in: 1, speed: 2 })]), ["a"], 1);
    const right = p.clips.find((c) => c.id !== "a") as MediaClip;
    expect(byId(p, "a").duration).toBeCloseTo(1);
    expect(right.start).toBeCloseTo(1);
    expect(right.in).toBeCloseTo(3);
    expect(sourceTime(right, 1)).toBeCloseTo(sourceTime(byId(p, "a") as MediaClip, 1));
  });

  it("splits linked partners too and keeps the right halves linked to each other", () => {
    const p = splitClips(
      project([clip("v", 0, 4, { linkId: "L" }), clip("a", 0, 4, { trackId: "A", linkId: "L" })]),
      ["v"],
      2,
    );
    expect(p.clips).toHaveLength(4);
    const rights = p.clips.filter((c) => c.start === 2);
    expect(rights).toHaveLength(2);
    expect(rights[0].linkId).toBe(rights[1].linkId);
    expect(rights[0].linkId).not.toBe("L");
  });

  it("carries keyframed motion across the cut", () => {
    const c = clip("a", 0, 4, {
      keyframes: {
        x: [
          { t: 0, v: 0 },
          { t: 4, v: 1 },
        ],
      },
    });
    const before = poseAt(c, 2).x;
    const p = splitClips(project([c]), ["a"], 2);
    const right = p.clips.find((x) => x.id !== "a")!;
    expect(poseAt(byId(p, "a"), 2).x).toBeCloseTo(before);
    expect(poseAt(right, 0).x).toBeCloseTo(before);
    expect(poseAt(right, 2).x).toBeCloseTo(1);
  });
});

describe("ripple", () => {
  it("ripple delete pulls later clips left on the same track", () => {
    const p = rippleDelete(project([clip("a", 0, 2), clip("b", 2, 3), clip("c", 5, 1)]), ["b"]);
    expect(byId(p, "c").start).toBeCloseTo(2);
  });

  it("ripple delete removes only the clip's own length, leaving gaps that were already there", () => {
    const p = rippleDelete(project([clip("a", 0, 2), clip("b", 3, 2), clip("c", 5, 1)]), ["b"]);
    expect(byId(p, "c").start).toBeCloseTo(3);
  });

  it("keeps linked partners in sync when closing a gap", () => {
    const base = project([
      clip("a", 0, 2),
      clip("b", 4, 2, { linkId: "L" }),
      clip("ba", 4, 2, { trackId: "A", linkId: "L" }),
    ]);
    const p = closeGap(base, byId(base, "a").trackId, 3);
    expect(byId(p, "b").start).toBeCloseTo(2);
    expect(byId(p, "ba").start).toBeCloseTo(2);
  });

  it("never pushes a linked partner into a clip that isn't moving", () => {
    const base = project([
      clip("b", 4, 2, { linkId: "L" }),
      clip("ba", 4, 2, { trackId: "A", linkId: "L" }),
      clip("blocker", 0, 3.5, { trackId: "A" }),
    ]);
    const p = rippleShift(base, [byId(base, "b").trackId], 4, -4);
    expect(byId(p, "ba").start).toBeCloseTo(3.5);
    expect(byId(p, "b").start).toBeCloseTo(3.5);
  });
});

describe("trim to playhead", () => {
  it("Q moves the start and the source in point; W cuts the tail", () => {
    const base = project([clip("a", 1, 4, { in: 2, speed: 0.5 })]);
    const q = byId(trimToTime(base, ["a"], 2, "start"), "a") as MediaClip;
    expect(q.start).toBeCloseTo(2);
    expect(q.duration).toBeCloseTo(3);
    expect(q.in).toBeCloseTo(2.5);
    const w = byId(trimToTime(base, ["a"], 3, "end"), "a");
    expect(w.duration).toBeCloseTo(2);
  });
});

describe("speed", () => {
  it("doubling the speed halves the clip, and its partner follows", () => {
    const base = project([clip("v", 0, 4, { linkId: "L" }), clip("a", 0, 4, { trackId: "A", linkId: "L" })]);
    const p = setSpeed(base, "v", 2, media);
    expect(byId(p, "v").duration).toBeCloseTo(2);
    expect(byId(p, "a").duration).toBeCloseTo(2);
    expect((byId(p, "a") as MediaClip).speed).toBe(2);
  });

  it("slowing down stops at the next clip and the end of the source", () => {
    const blocked = setSpeed(project([clip("a", 0, 4), clip("b", 6, 1)]), "a", 0.5, media);
    expect(byId(blocked, "a").duration).toBeCloseTo(6);
    const short = setSpeed(project([clip("a", 0, 4, { in: 18 })]), "a", 0.25, media);
    expect(byId(short, "a").duration).toBeCloseTo(8); // 2s of source left at quarter speed
  });
});

describe("links", () => {
  it("withLinked expands a selection to its partners", () => {
    const p = setLink(project([clip("a", 0, 1), clip("b", 0, 1, { trackId: "A" }), clip("c", 2, 1)]), ["a", "b"], true);
    expect([...withLinked(p, ["a"])].sort()).toEqual(["a", "b"]);
    expect([...withLinked(setLink(p, ["a"], false), ["a"])]).toEqual(["a"]);
  });
});

describe("keyframes", () => {
  it("editing an animated property keys it; a static one just changes", () => {
    let c = clip("a", 0, 4);
    c = toggleKeyframe(c, "scale", 0, 0.01);
    c = applyPose(c, { scale: 2, x: 0.3 }, 2, 0.01);
    expect(c.x).toBe(0.3);
    expect(c.keyframes.scale).toHaveLength(2);
    expect(poseAt(c, 2).scale).toBeCloseTo(2);
    expect(poseAt(c, 1).scale).toBeGreaterThan(1);
    expect(poseAt(c, 1).scale).toBeLessThan(2);
    expect(keyframeTimes(c)).toEqual([0, 2]);
  });

  it("removing the last keyframe leaves the value it held", () => {
    let c = clip("a", 0, 4, { opacity: 1 });
    c = toggleKeyframe(c, "opacity", 1, 0.01);
    c = applyPose(c, { opacity: 0.4 }, 1, 0.01);
    c = toggleKeyframe(c, "opacity", 1, 0.01);
    expect(c.keyframes.opacity).toBeUndefined();
    expect(c.opacity).toBeCloseTo(0.4);
  });
});

describe("transitions", () => {
  it("a crossfade overlaps both clips around the cut", () => {
    const p = project([clip("a", 0, 4), clip("b", 4, 4, { transition: { kind: "crossfade", duration: 1 } })]);
    const edges = transitionMap(p);
    expect(visualWindow(byId(p, "a"), edges.get("a"))).toEqual([0, 4.5]);
    expect(visualWindow(byId(p, "b"), edges.get("b"))).toEqual([3.5, 8]);
    expect(transitionAlpha(byId(p, "b"), edges.get("b"), 4)).toBeCloseTo(0.5);
    expect(transitionAlpha(byId(p, "a"), edges.get("a"), 4.2)).toBe(1);
  });

  it("a dip takes the outgoing clip to nothing before the next comes up", () => {
    const p = project([clip("a", 0, 4), clip("b", 4, 4, { transition: { kind: "dip", duration: 1 } })]);
    const edges = transitionMap(p);
    expect(transitionAlpha(byId(p, "a"), edges.get("a"), 4)).toBeCloseTo(0);
    expect(transitionAlpha(byId(p, "b"), edges.get("b"), 4)).toBeCloseTo(0);
    expect(transitionAlpha(byId(p, "b"), edges.get("b"), 4.5)).toBeCloseTo(1);
  });

  it("a transition with nothing before it fades in", () => {
    const p = project([clip("b", 2, 4, { transition: { kind: "crossfade", duration: 1 } })]);
    const edges = transitionMap(p);
    expect(visualWindow(byId(p, "b"), edges.get("b"))).toEqual([2, 6]);
    expect(transitionAlpha(byId(p, "b"), edges.get("b"), 2.5)).toBeCloseTo(0.5);
  });
});

describe("normalizeProject", () => {
  it("fills in fields an older autosave doesn't have", () => {
    const old = createProject() as Partial<Project> as Project;
    const legacy = {
      ...old,
      markers: undefined,
      clips: [
        {
          id: "m",
          type: "media",
          trackId: "t",
          mediaId: "m1",
          start: 0,
          duration: 1,
          in: 0,
          x: 0.5,
          y: 0.5,
          opacity: 1,
          scale: 1,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
        {
          id: "t",
          type: "text",
          trackId: "t",
          start: 0,
          duration: 1,
          text: "hi",
          size: 96,
          color: "#fff",
          background: null,
          bold: true,
          x: 0.5,
          y: 0.5,
          opacity: 1,
        },
      ],
    } as unknown as Project;
    const p = normalizeProject(legacy);
    expect(p.markers).toEqual([]);
    const m = p.clips[0] as MediaClip;
    expect(m.speed).toBe(1);
    expect(m.crop.left).toBe(0);
    expect(m.keyframes).toEqual({});
    const t = p.clips[1];
    expect(t.type === "text" && t.font).toBe("sans");
    expect(t.scale).toBe(1);
    expect(newTextClip({ id: "x", trackId: "t", start: 0, duration: 1 }).animIn).toBe("none");
  });
});

import { CaptionIcon } from "@/components/icons/audio";

/**
 * Subtitling is one tool that belongs to two families.
 *
 * Someone looking for captions may well be thinking about the video they are
 * captioning or about the interview recording they want a transcript of, so it
 * is listed under both Audio and Video. Both lists point at the same entry
 * rather than each keeping a copy: the keywords and the format map here feed
 * search, and two copies of them would drift apart the first time either is
 * touched.
 *
 * `allTools` concatenates the family lists, so it de-duplicates by href — this
 * tool would otherwise appear twice on the "All" tab, under the same React key.
 */
export const subtitlesTool = {
  title: "Subtitles",
  description: "Turn speech into timed, editable captions",
  href: "/caption",
  icon: CaptionIcon,
  category: "convert",
  colorClass: "tool-caption",
  keywords: [
    "subtitles",
    "captions",
    "cc",
    "srt",
    "vtt",
    "transcribe",
    "transcript",
    "speech to text",
    "auto caption",
    "closed captions",
    "dictation",
  ],
  io: {
    from: ["mp4", "mov", "mkv", "webm", "m4v", "mp3", "wav", "m4a", "aac", "flac", "ogg", "video", "audio"],
    to: ["srt", "vtt", "txt", "text"],
  },
};

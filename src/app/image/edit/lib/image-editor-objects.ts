// Re-export shared types and functions from the PDF editor — single source of truth
export type {
  EditorObjectRecord,
  EditorObjectKind,
  EditorAsset,
  EditorStyle,
} from "@/app/edit/lib/editor-objects";

export {
  loadFabricModule,
  attachEditorMetadata,
  fabricObjectToRecord,
  recordToFabricObject,
  createStampDataUrl,
} from "@/app/edit/lib/editor-objects";

export type { StampData } from "@/app/edit/components/EditorToolbar";

import type { EditorAsset } from "@/app/edit/lib/editor-objects";

export function assetFromDataUrl(dataUrl: string): EditorAsset {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return { dataUrl, mimeType: match?.[1] || "image/png" };
}

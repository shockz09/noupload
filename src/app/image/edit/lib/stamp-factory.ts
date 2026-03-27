import {
  assetFromDataUrl,
  attachEditorMetadata,
  createStampDataUrl,
  loadFabricModule,
  type StampData,
} from "./image-editor-objects";

interface StampResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any;
  radius: number;
}

/**
 * Creates a Fabric.js group for a circle stamp with serrated edges,
 * curved text, decorative stars, and a center banner.
 */
async function createCircleStamp(
  stamp: StampData,
  x: number,
  y: number,
  angle: number,
): Promise<StampResult> {
  const { Circle, FabricText, Group, Path } = await loadFabricModule();

  const color = stamp.color;
  const text = stamp.text.toUpperCase();
  const radius = 80;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = [];

  // Serrated outer edge
  const teeth = 48;
  const innerR = radius - 5;
  let serratedPath = "";

  for (let i = 0; i < teeth; i++) {
    const a1 = (((i * 360) / teeth) * Math.PI) / 180;
    const a2 = ((((i + 0.5) * 360) / teeth) * Math.PI) / 180;
    const a3 = ((((i + 1) * 360) / teeth) * Math.PI) / 180;

    const x1 = Math.cos(a1) * radius;
    const y1 = Math.sin(a1) * radius;
    const x2 = Math.cos(a2) * innerR;
    const y2 = Math.sin(a2) * innerR;
    const x3 = Math.cos(a3) * radius;
    const y3 = Math.sin(a3) * radius;

    serratedPath += i === 0 ? `M ${x1} ${y1}` : "";
    serratedPath += ` L ${x2} ${y2} L ${x3} ${y3}`;
  }
  serratedPath += " Z";

  elements.push(
    new Path(serratedPath, {
      fill: color,
      stroke: color,
      strokeWidth: 1,
      originX: "center",
      originY: "center",
    }),
  );

  // Inner white circle
  elements.push(
    new Circle({ radius: radius - 8, fill: "#FFFFFF", stroke: "transparent", originX: "center", originY: "center" }),
  );

  // Colored ring
  elements.push(
    new Circle({
      radius: radius - 10,
      fill: "transparent",
      stroke: color,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
    }),
  );

  // Inner white circle for text area
  elements.push(
    new Circle({ radius: radius - 14, fill: "#FFFFFF", stroke: "transparent", originX: "center", originY: "center" }),
  );

  // Curved text (top + bottom arcs)
  const textRadius = radius - 25;
  const curvedFontSize = text.length > 10 ? 9 : text.length > 7 ? 10 : 11;
  const charSpacing = Math.min(150 / text.length, 15);
  const totalAngle = text.length * charSpacing;
  const topStart = -90 - totalAngle / 2;

  for (let i = 0; i < text.length; i++) {
    const charAngle = topStart + (i + 0.5) * charSpacing;
    const rad = (charAngle * Math.PI) / 180;
    elements.push(
      new FabricText(text[i], {
        left: Math.cos(rad) * textRadius,
        top: Math.sin(rad) * textRadius,
        fontSize: curvedFontSize,
        fontFamily: "Arial Black, Arial, sans-serif",
        fontWeight: "bold",
        fill: color,
        originX: "center",
        originY: "center",
        angle: charAngle + 90,
      }),
    );
  }

  const bottomStart = 90 + totalAngle / 2;
  for (let i = 0; i < text.length; i++) {
    const charAngle = bottomStart - (i + 0.5) * charSpacing;
    const rad = (charAngle * Math.PI) / 180;
    elements.push(
      new FabricText(text[i], {
        left: Math.cos(rad) * textRadius,
        top: Math.sin(rad) * textRadius,
        fontSize: curvedFontSize,
        fontFamily: "Arial Black, Arial, sans-serif",
        fontWeight: "bold",
        fill: color,
        originX: "center",
        originY: "center",
        angle: charAngle - 90,
      }),
    );
  }

  // Decorative side stars
  elements.push(
    new FabricText("\u2605", { left: -textRadius, top: 0, fontSize: 8, fill: color, originX: "center", originY: "center" }),
    new FabricText("\u2605", { left: textRadius, top: 0, fontSize: 8, fill: color, originX: "center", originY: "center" }),
  );

  // Center banner
  const bannerW = Math.max(50, text.length * 6);
  const bannerH = 28;
  const bannerPath = `
    M ${-bannerW} ${-bannerH / 2}
    Q ${-bannerW - 8} 0 ${-bannerW} ${bannerH / 2}
    L ${bannerW} ${bannerH / 2}
    Q ${bannerW + 8} 0 ${bannerW} ${-bannerH / 2}
    Z
  `;
  elements.push(
    new Path(bannerPath, { fill: color, stroke: color, strokeWidth: 1, originX: "center", originY: "center" }),
  );

  // Center text
  const centerFontSize = text.length > 10 ? 14 : text.length > 7 ? 16 : 18;
  elements.push(
    new FabricText(text, {
      left: 0,
      top: 0,
      fontSize: centerFontSize,
      fontFamily: "Arial Black, Arial, sans-serif",
      fontWeight: "bold",
      fill: "#FFFFFF",
      originX: "center",
      originY: "center",
      angle: -6,
    }),
  );

  // Stars above banner
  elements.push(
    new FabricText("\u2605", { left: -18, top: -18, fontSize: 7, fill: color, originX: "center", originY: "center" }),
    new FabricText("\u2605", { left: 0, top: -22, fontSize: 7, fill: color, originX: "center", originY: "center" }),
    new FabricText("\u2605", { left: 18, top: -18, fontSize: 7, fill: color, originX: "center", originY: "center" }),
  );

  const group = new Group(elements, {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    angle,
  });

  return { group, radius };
}

/**
 * Creates a Fabric.js group for a rectangular stamp with double border.
 */
async function createRectStamp(
  stamp: StampData,
  x: number,
  y: number,
  angle: number,
): Promise<StampResult> {
  const { FabricText, Group, Rect } = await loadFabricModule();

  const color = stamp.color;
  const text = stamp.text.toUpperCase();
  const fontSize = text.length > 10 ? 22 : text.length > 6 ? 26 : 30;
  const padding = 14;

  const stampText = new FabricText(text, {
    fontSize,
    fontFamily: "Arial Black, Arial, sans-serif",
    fontWeight: "bold",
    fill: color,
    originX: "center",
    originY: "center",
  });

  const textWidth = stampText.width || 100;
  const textHeight = stampText.height || 30;
  const borderW = textWidth + padding * 2;
  const borderH = textHeight + padding * 1.5;
  const radius = Math.max(borderW, borderH) / 2;

  const outerBorder = new Rect({
    width: borderW + 8,
    height: borderH + 8,
    fill: "transparent",
    stroke: color,
    strokeWidth: 4,
    rx: 2,
    ry: 2,
    originX: "center",
    originY: "center",
  });

  const innerBorder = new Rect({
    width: borderW,
    height: borderH,
    fill: "transparent",
    stroke: color,
    strokeWidth: 2,
    rx: 1,
    ry: 1,
    originX: "center",
    originY: "center",
  });

  const group = new Group([outerBorder, innerBorder, stampText], {
    left: x,
    top: y,
    originX: "center",
    originY: "center",
    angle,
  });

  return { group, radius };
}

/**
 * Creates a stamp Fabric group, attaches editor metadata, and returns
 * the group + radius for animation purposes.
 */
export async function createStampGroup(
  stamp: StampData,
  x: number,
  y: number,
  angle: number,
): Promise<StampResult> {
  const result =
    stamp.shape === "circle"
      ? await createCircleStamp(stamp, x, y, angle)
      : await createRectStamp(stamp, x, y, angle);

  attachEditorMetadata(result.group, {
    editorKind: "stamp",
    sourceTool: "stamp",
    stampData: stamp,
    asset: assetFromDataUrl(createStampDataUrl(stamp)),
  });

  return result;
}

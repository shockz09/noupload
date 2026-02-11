import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1A1612",
      }}
    >
      <div
        style={{
          width: 116,
          height: 116,
          background: "#C84C1C",
          border: "4px solid #FAF7F2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          fontSize: 48,
          fontWeight: "bold",
          color: "#FAF7F2",
        }}
      >
        NU
      </div>
    </div>,
    { ...size },
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#C84C1C",
          borderRadius: 32,
        }}
      >
        <span
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: "#FAF7F2",
            fontFamily: "Georgia, serif",
          }}
        >
          N
        </span>
      </div>
    ),
    { ...size }
  );
}

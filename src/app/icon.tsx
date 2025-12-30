import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 4,
        }}
      >
        <span
          style={{
            fontSize: 18,
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

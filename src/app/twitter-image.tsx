import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "noupload/pdf - Free, private PDF tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#FAF8F5",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Border */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          border: "4px solid #1a1a1a",
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#1a1a1a",
            display: "flex",
          }}
        >
          noupload/
          <span style={{ color: "#E85D04" }}>pdf</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: "#666",
            display: "flex",
          }}
        >
          Private PDF tools that run in your browser
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 24,
            fontSize: 20,
            fontWeight: 600,
            color: "#1a1a1a",
          }}
        >
          <span>No uploads</span>
          <span style={{ color: "#999" }}>·</span>
          <span>No servers</span>
          <span style={{ color: "#999" }}>·</span>
          <span>Free forever</span>
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}

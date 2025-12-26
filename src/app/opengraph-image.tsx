import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "noupload/pdf - Private PDF Tools";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
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
              gap: 32,
              marginTop: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "#2D5A3D",
                  border: "2px solid #1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              No uploads
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "#2D5A3D",
                  border: "2px solid #1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              No servers
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "#2D5A3D",
                  border: "2px solid #1a1a1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              Free forever
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

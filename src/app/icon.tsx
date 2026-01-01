import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "#FAF7F2",
			}}
		>
			<div
				style={{
					width: 28,
					height: 28,
					background: "#C84C1C",
					border: "2px solid #1A1612",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Georgia, serif",
					fontSize: 12,
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

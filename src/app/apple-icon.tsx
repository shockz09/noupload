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
				borderRadius: "50%",
			}}
		>
			<div
				style={{
					width: 150,
					height: 150,
					background: "#C84C1C",
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Georgia, serif",
					fontSize: 60,
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

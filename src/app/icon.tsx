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
				background: "#1A1612",
				borderRadius: "50%",
			}}
		>
			<div
				style={{
					width: 26,
					height: 26,
					background: "#C84C1C",
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "Georgia, serif",
					fontSize: 11,
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

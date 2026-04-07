import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sanitize")({
	beforeLoad: () => {
		throw redirect({ to: "/metadata" });
	},
});

import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./app/globals.css";

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

// The build writes each page's title/meta into its HTML for crawlers (see
// scripts/prerender-seo.mjs). Route head() takes over from here, so drop the
// static copies to avoid duplicates; keep canonical and JSON-LD, and keep the
// canonical pointing at whatever page we navigate to.
document.querySelectorAll("head [data-ssg]:not(link[rel=canonical]):not(script)").forEach((el) => el.remove());
router.subscribe("onResolved", ({ toLocation }) => {
	const canonical = document.querySelector<HTMLLinkElement>("link[rel=canonical]");
	if (canonical) canonical.href = `https://noupload.xyz${toLocation.pathname === "/" ? "/" : toLocation.pathname.replace(/\/$/, "")}`;
});

ReactDOM.createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);

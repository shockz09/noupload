import { Suspense, lazy } from "react";

const VercelAnalytics = lazy(() => import("@vercel/analytics/react").then((mod) => ({ default: mod.Analytics })));

export function Analytics() {
	return (
		<Suspense>
			<VercelAnalytics />
		</Suspense>
	);
}

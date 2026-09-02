// Analytics metrics are optional; required bindings come from Wrangler typegen.
interface Env {
	/** API token with Account Analytics Read permission — used to query Analytics Engine SQL API from /admin/metrics. */
	AE_API_TOKEN?: string;
}

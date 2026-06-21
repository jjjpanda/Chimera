const json = (body, status = 200) => ({
	status,
	contentType: "application/json",
	body: JSON.stringify(body)
})

const defaultRoutes = {
	"GET /authorization/status": json({ setup: true, tokenRequired: false }),
	"POST /authorization/verify": json({ error: true }),
	"POST /authorization/login": json({ error: false, role: "admin", theme: "system" }),
	"PUT /authorization/theme": json({ error: false }),
	"POST /authorization/logout": json({ error: false }),
	"POST /authorization/setup": json({ error: false }),
	"POST /authorization/password": json({ error: false }),
	"GET /cameras": json([{ id: 0, name: "indoor" }, { id: 1, name: "outdoor" }]),
	"GET /usage": json({ used_gb: 0, max_gb: 100, total_frames: 0, cameras: [] })
}

const apiPrefixes = [
	"/authorization", "/cameras", "/command", "/schedule", "/storage",
	"/motion", "/database", "/livestream", "/memory", "/object",
	"/file", "/frames", "/usage", "/task", "/convert", "/events", "/shared"
]

const isApi = (pathname) =>
	apiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

const mockApi = (page, overrides = {}) => {
	const routes = { ...defaultRoutes, ...overrides }
	return page.route("**/*", (route) => {
		const request = route.request()
		const { pathname } = new URL(request.url())
		const response = routes[`${request.method()} ${pathname}`]
		if (response) return route.fulfill(response)
		if (isApi(pathname)) return route.fulfill(json([]))
		return route.continue()
	})
}

const login = async (page, { username = "admin", password = "password123" } = {}) => {
	await page.getByPlaceholder("username").fill(username)
	await page.getByPlaceholder("password").fill(password)
	await page.getByRole("button", { name: "Sign In" }).click()
}

module.exports = { json, mockApi, login }

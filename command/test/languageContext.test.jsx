/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => ({
	request: (...args) => { requests.push(args) }
}))

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: () => {} }))

// every locale keeps its real definition except load(), which a test can stall to control chunk arrival order
jest.mock("../frontend/js/languages.js", () => {
	const actual = jest.requireActual("../frontend/js/languages.js")
	const stubbed = Object.fromEntries(Object.entries(actual.LANGUAGES).map(([tag, language]) =>
		[tag, { ...language, load: () => loads[tag] ?? language.load() }]))
	return { ...actual, LANGUAGES: stubbed }
})

// i18nSetup.js already loaded js/i18n.js against the real js/languages.js; drop it so both pick up the mock
jest.resetModules()

const React = require("react")
const { render, screen, fireEvent, waitFor, act } = require("@testing-library/react")
const moment = require("moment")
const i18n = require("../frontend/js/i18n.js").default
const { LanguageProvider, useLanguage } = require("../frontend/app/LanguageContext.jsx")

const requests = []
const loads = {}

beforeEach(() => {
	localStorage.clear()
	requests.length = 0
	Object.keys(loads).forEach((tag) => delete loads[tag])
	Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true })
})

const Consumer = () => {
	const { language, applyLanguage } = useLanguage()
	return React.createElement("button", { "data-testid": "language", onClick: () => applyLanguage("ja") }, language)
}

const renderWithProvider = (props) => render(
	React.createElement(LanguageProvider, props, React.createElement(Consumer))
)

test("logging in applies the server language and persists it", () => {
	renderWithProvider({ serverLanguage: "ko", loggedIn: true })

	expect(screen.getByTestId("language").textContent).toBe("ko")
	expect(localStorage.getItem("language")).toBe("ko")
	expect(document.documentElement.lang).toBe("ko")
})

test("a fresh login with no server language lands on en rather than a stale local language", () => {
	localStorage.setItem("language", "ja")

	renderWithProvider({ serverLanguage: null, loggedIn: true })

	expect(screen.getByTestId("language").textContent).toBe("en")
})

test("a logged-out render falls back to navigator.language on the base tag", () => {
	Object.defineProperty(navigator, "languages", { value: ["pt-PT"], configurable: true })

	renderWithProvider({ serverLanguage: "ko", loggedIn: false })

	expect(screen.getByTestId("language").textContent).toBe("pt-BR")
})

test("an unsupported navigator language falls back to en", () => {
	Object.defineProperty(navigator, "languages", { value: ["is-IS"], configurable: true })

	renderWithProvider({ serverLanguage: null, loggedIn: false })

	expect(screen.getByTestId("language").textContent).toBe("en")
})

test("picking a language pre-login changes it without calling the server", () => {
	renderWithProvider({ serverLanguage: null, loggedIn: false })
	fireEvent.click(screen.getByTestId("language"))

	expect(screen.getByTestId("language").textContent).toBe("ja")
	expect(requests).toHaveLength(0)
})

test("picking a language while logged in saves it to the server", () => {
	renderWithProvider({ serverLanguage: "en", loggedIn: true })
	fireEvent.click(screen.getByTestId("language"))

	expect(requests).toHaveLength(1)
	expect(requests[0][0]).toBe("/authorization/language")
	expect(JSON.parse(requests[0][1].body)).toEqual({ language: "ja" })
})

test("importing the provider leaves moment on en rather than the last defined locale", () => {
	jest.isolateModules(() => {
		const freshMoment = require("moment")
		require("../frontend/app/LanguageContext.jsx")

		expect(freshMoment.locale()).toBe("en")
	})
})

test("a chunk that lands after a newer language change does not switch i18next back", async () => {
	const stall = (tag) => {
		let land
		loads[tag] = new Promise((resolve) => { land = () => resolve([]) })
		return () => land()
	}
	const landSpanish = stall("es")
	const landGerman = stall("de")

	const { rerender } = renderWithProvider({ serverLanguage: "es", loggedIn: true })
	rerender(React.createElement(LanguageProvider, { serverLanguage: "de", loggedIn: true },
		React.createElement(Consumer)))

	await act(async () => landGerman())
	await act(async () => landSpanish())

	expect(i18n.language).toBe("de")
	expect(screen.getByTestId("language").textContent).toBe("de")
})

test.each(["hi", "gu"])("%s formats and parses machine timestamps in ASCII digits", async (tag) => {
	renderWithProvider({ serverLanguage: tag, loggedIn: true })
	await waitFor(() => expect(moment.locale()).toBe(tag))

	expect(moment.utc("2025-08-08T12:34:56Z").format("YYYYMMDD-HHmmss")).toBe("20250808-123456")
	expect(moment.utc("2025-08-08T12:34:56Z").format("YYYY-MM-DD")).toBe("2025-08-08")
	expect(moment.utc("20250808-123456", "YYYYMMDD-HHmmss", true).isValid()).toBe(true)
	expect(moment.utc("2025-08-08T12:34:56Z").format("MMMM")).not.toMatch(/^[A-Za-z]+$/)
})

/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => ({
	request: (...args) => { requests.push(args) }
}))

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: () => {} }))

const React = require("react")
const { render, screen, fireEvent } = require("@testing-library/react")
const { LanguageProvider, useLanguage } = require("../frontend/app/LanguageContext.jsx")

const requests = []

beforeEach(() => {
	localStorage.clear()
	requests.length = 0
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

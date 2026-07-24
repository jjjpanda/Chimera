/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => ({
	request: () => {}
}))

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: () => {} }))

const React = require("react")
const { render, screen } = require("@testing-library/react")
const { ThemeProvider, useTheme } = require("../frontend/app/ThemeContext.jsx")

const mediaListeners = []
const mockMedia = { matches: false, addEventListener: (e, cb) => mediaListeners.push(cb), removeEventListener: () => {} }

beforeEach(() => {
	localStorage.clear()
	mediaListeners.length = 0
	window.matchMedia = jest.fn().mockReturnValue(mockMedia)
})

const Consumer = () => {
	const { theme } = useTheme()
	return React.createElement("div", { "data-testid": "theme" }, theme)
}

const renderWithProvider = (props) => render(
	React.createElement(ThemeProvider, props, React.createElement(Consumer))
)

test("a fresh login with no server theme lands on system rather than a stale local theme", () => {
	localStorage.setItem("theme", "dark")

	renderWithProvider({ serverTheme: null, loggedIn: true })

	expect(screen.getByTestId("theme").textContent).toBe("system")
	expect(localStorage.getItem("theme")).toBe("system")
})

test("a logged-out render does not apply or persist the stale serverTheme still being passed down", () => {
	localStorage.setItem("theme", "light")

	renderWithProvider({ serverTheme: "dark", loggedIn: false })

	expect(screen.getByTestId("theme").textContent).toBe("light")
	expect(localStorage.getItem("theme")).toBe("light")
})

test("logging in applies the server theme and persists it", () => {
	renderWithProvider({ serverTheme: "dark", loggedIn: true })

	expect(screen.getByTestId("theme").textContent).toBe("dark")
	expect(localStorage.getItem("theme")).toBe("dark")
})

/** @jest-environment jsdom */

jest.mock("../frontend/js/request.js", () => ({
	request: (...args) => { requests.push(args) }
}))

jest.mock("../frontend/js/toast.js", () => ({ __esModule: true, default: () => {} }))

const React = require("react")
const { render, screen, fireEvent, act } = require("@testing-library/react")
const { LanguageProvider } = require("../frontend/app/LanguageContext.jsx")
const LanguagePicker = require("../frontend/app/LanguagePicker.jsx").default
const tags = require("../frontend/js/languages.js").default
const { LANGUAGES } = require("../frontend/js/languages.js")

const requests = []

beforeAll(() => {
	Element.prototype.hasPointerCapture = () => false
	Element.prototype.setPointerCapture = () => {}
	Element.prototype.releasePointerCapture = () => {}
	Element.prototype.scrollIntoView = () => {}
	global.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

beforeEach(() => {
	localStorage.clear()
	requests.length = 0
	Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true })
})

const flush = () => act(async () => {})

const renderPicker = async (props) => {
	const view = render(React.createElement(LanguageProvider, props, React.createElement(LanguagePicker)))
	await flush()
	return view
}

const openMenu = () => fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" })

test("every supported language is offered, labelled in its own language", async () => {
	await renderPicker({ serverLanguage: "en", loggedIn: true })
	openMenu()

	const options = screen.getAllByRole("option")

	expect(options).toHaveLength(tags.length)
	expect(options.map((option) => option.textContent)).toEqual(tags.map((tag) => LANGUAGES[tag].label))
})

test("the trigger shows the active language", async () => {
	await renderPicker({ serverLanguage: "ja", loggedIn: true })

	expect(screen.getByRole("combobox").textContent).toBe(LANGUAGES["ja"].label)
})

test("picking an option applies the language and saves it", async () => {
	await renderPicker({ serverLanguage: "en", loggedIn: true })
	openMenu()
	fireEvent.click(screen.getByRole("option", { name: LANGUAGES["ja"].label }))
	await flush()

	expect(screen.getByRole("combobox").textContent).toBe(LANGUAGES["ja"].label)
	expect(localStorage.getItem("language")).toBe("ja")
	expect(requests).toHaveLength(1)
	expect(requests[0][0]).toBe("/authorization/language")
	expect(JSON.parse(requests[0][1].body)).toEqual({ language: "ja" })
})

test("picking an option pre-login applies it without calling the server", async () => {
	await renderPicker({ serverLanguage: null, loggedIn: false })
	openMenu()
	fireEvent.click(screen.getByRole("option", { name: LANGUAGES["de"].label }))
	await flush()

	expect(screen.getByRole("combobox").textContent).toBe(LANGUAGES["de"].label)
	expect(requests).toHaveLength(0)
})

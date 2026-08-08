import i18n from "./i18n.js"

const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"]

export default (bytes, decimals = 2) => {
	const value = Number(bytes) || 0
	const magnitude = value === 0 ? 0 : Math.floor(Math.log(Math.abs(value)) / Math.log(1024))
	const i = Math.min(Math.max(magnitude, 0), UNITS.length - 1)

	return new Intl.NumberFormat(i18n.language, {
		style: "unit",
		unit: UNITS[i],
		unitDisplay: "short",
		maximumFractionDigits: Math.max(0, decimals)
	}).format(value / Math.pow(1024, i))
}

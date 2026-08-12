import i18n from "./i18n.js"

const UNITS = ["units.kb", "units.mb", "units.gb", "units.tb", "units.pb"]

export default (bytes, decimals = 2) => {
	const value = Number(bytes) || 0
	const magnitude = value === 0 ? 0 : Math.floor(Math.log(Math.abs(value)) / Math.log(1024))
	const i = Math.min(Math.max(magnitude, 0), UNITS.length)
	const scaled = value / Math.pow(1024, i)
	const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: Math.max(0, decimals) }).format(scaled)

	return `${number} ${i === 0 ? i18n.t("units.bytes", { count: scaled }) : i18n.t(UNITS[i - 1])}`
}

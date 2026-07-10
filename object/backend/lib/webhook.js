const WEBHOOK_TIMEOUT_MS = 5000

module.exports = async (url, content, jpeg) => {
	if (!url) return
	try {
		const form = new FormData()
		if (content) form.append("content", content)
		if (jpeg && jpeg.length) form.append("file", new Blob([jpeg], { type: "image/jpeg" }), "detection.jpg")
		await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS) })
	} catch (e) {
		console.log("object webhook failed", e.message)
	}
}

const { test, expect } = require("@playwright/test")
const { json, mockApi } = require("./api")

const asAdminSession = {
	"POST /authorization/verify": json({ error: false, role: "admin", forcePasswordChange: false }),
	"GET /authorization/users": json([
		{ username: "admin", role: "admin", last_login: new Date().toISOString() },
		{ username: "viewer", role: "user", last_login: null }
	]),
	"GET /motion/sensitivity": json({
		threshold: 1500,
		defaultThreshold: 1500,
		cameras: [
			{ id: 0, name: "indoor", threshold: 1500, isCustom: false },
			{ id: 1, name: "outdoor", threshold: 800, isCustom: true }
		]
	}),
	"PUT /motion/sensitivity": json({ threshold: 2000, motionRestarted: true }),
	"PUT /motion/sensitivity/0": json({ id: 0, threshold: 2500, isCustom: true, motionRestarted: true }),
	"PUT /motion/sensitivity/1": json({ id: 1, threshold: 1500, isCustom: false, motionRestarted: true })
}

test.describe("motion sensitivity settings in admin panel", () => {
	test("renders motion sensitivity controls with per-camera tabs, updates default, sets custom override, and reverts", async ({ page }) => {
		await mockApi(page, asAdminSession)
		await page.goto("/admin")

		// Verify Motion Detection Sensitivity card
		const sensitivityHeading = page.getByText("Motion Detection Sensitivity")
		await expect(sensitivityHeading).toBeVisible()

		// Verify tabs exist
		const systemTab = page.getByRole("tab", { name: "System Default" })
		const indoorTab = page.getByRole("tab", { name: "indoor" })
		const outdoorTab = page.getByRole("tab", { name: "outdoor" })

		await expect(systemTab).toBeVisible()
		await expect(indoorTab).toBeVisible()
		await expect(outdoorTab).toBeVisible()

		// 1. Check System Default tab
		const defaultInput = page.getByLabel("Sensitivity Threshold")
		await expect(defaultInput).toBeVisible()
		await expect(defaultInput).toHaveValue("1500")

		const defaultSaveButton = page.getByRole("button", { name: "Save Sensitivity" })
		await expect(defaultSaveButton).toBeDisabled()

		// Change System Default threshold
		await defaultInput.fill("2000")
		await expect(defaultSaveButton).toBeEnabled()
		await defaultSaveButton.click()
		await expect(page.getByText("Motion sensitivity updated")).toBeVisible()
		await expect(defaultSaveButton).toBeDisabled()

		// 2. Switch to Indoor camera tab (inheriting default)
		await indoorTab.click()
		await expect(page.getByText(/Inheriting system default/)).toBeVisible()
		const indoorInput = page.getByLabel("indoor Sensitivity Threshold")
		await expect(indoorInput).toBeVisible()

		const cameraSaveButton = page.getByRole("button", { name: "Save Sensitivity" })
		await expect(cameraSaveButton).toBeDisabled()

		// Set custom override on indoor camera
		await indoorInput.fill("2500")
		await expect(cameraSaveButton).toBeEnabled()
		await cameraSaveButton.click()
		await expect(page.getByText("Camera sensitivity updated")).toBeVisible()
		await expect(page.getByText("Custom Sensitivity")).toBeVisible()
		await expect(page.getByRole("button", { name: "Revert to Default" })).toBeVisible()

		// 3. Switch to Outdoor camera tab (already custom override)
		await outdoorTab.click()
		await expect(page.getByText("Custom Sensitivity")).toBeVisible()
		const outdoorInput = page.getByLabel("outdoor Sensitivity Threshold")
		await expect(outdoorInput).toBeVisible()
		await expect(outdoorInput).toHaveValue("800")

		const revertButton = page.getByRole("button", { name: "Revert to Default" })
		await expect(revertButton).toBeVisible()

		// Revert outdoor camera back to default
		await revertButton.click()
		await expect(page.getByText("Reverted to system default sensitivity")).toBeVisible()
		await expect(page.getByText(/Inheriting system default/)).toBeVisible()
	})
})

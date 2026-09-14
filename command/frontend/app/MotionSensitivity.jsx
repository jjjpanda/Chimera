import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Slider } from "../components/ui/slider"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs"
import { request, authPromiseHandler } from "../js/request.js"
import toast from "../js/toast.js"

const MIN_THRESHOLD = 100
const MAX_THRESHOLD = 10000

const MotionSensitivity = () => {
	const { t } = useTranslation()
	const [activeTab, setActiveTab] = useState("default")
	const [defaultThreshold, setDefaultThreshold] = useState(1500)
	const [initialDefaultThreshold, setInitialDefaultThreshold] = useState(1500)
	const [cameras, setCameras] = useState([])
	const [initialCameras, setInitialCameras] = useState([])
	const [loading, setLoading] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState(false)

	const fetchSensitivity = () => {
		setLoading(true)
		setError(false)
		request("/motion/sensitivity", { method: "GET" }, authPromiseHandler)
			.then(data => {
				if (data && typeof data.threshold === "number") {
					const def = data.defaultThreshold ?? data.threshold
					setDefaultThreshold(def)
					setInitialDefaultThreshold(def)
					const cams = Array.isArray(data.cameras) ? data.cameras : []
					setCameras(cams)
					setInitialCameras(JSON.parse(JSON.stringify(cams)))
				} else {
					setError(true)
				}
				setLoading(false)
			})
	}

	useEffect(() => {
		fetchSensitivity()
	}, [])

	const handleSaveDefault = () => {
		const val = parseInt(defaultThreshold, 10)
		if (!Number.isInteger(val) || val < 1) return
		setSaving(true)
		request("/motion/sensitivity", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ threshold: val })
		}, authPromiseHandler).then(res => {
			setSaving(false)
			if (res && !res.error) {
				setInitialDefaultThreshold(val)
				setCameras(prev => prev.map(c => c.isCustom ? c : { ...c, threshold: val }))
				setInitialCameras(prev => prev.map(c => c.isCustom ? c : { ...c, threshold: val }))
				toast(res.motionRestarted === false ? t("admin.motion.savedRestartFailed") : t("admin.motion.saved"))
			} else {
				toast(t("admin.motion.failed"))
			}
		})
	}

	const handleCameraThresholdChange = (camId, val) => {
		setCameras(prev => prev.map(c => c.id === camId ? { ...c, threshold: val } : c))
	}

	const handleSaveCamera = (camId) => {
		const cam = cameras.find(c => c.id === camId)
		if (!cam) return
		const val = parseInt(cam.threshold, 10)
		if (!Number.isInteger(val) || val < 1) return
		setSaving(true)
		request(`/motion/sensitivity/${camId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ threshold: val })
		}, authPromiseHandler).then(res => {
			setSaving(false)
			if (res && !res.error) {
				setCameras(prev => prev.map(c => c.id === camId ? { ...c, threshold: val, isCustom: true } : c))
				setInitialCameras(prev => prev.map(c => c.id === camId ? { ...c, threshold: val, isCustom: true } : c))
				toast(res.motionRestarted === false ? t("admin.motion.savedRestartFailed") : t("admin.motion.cameraSaved"))
			} else {
				toast(t("admin.motion.failed"))
			}
		})
	}

	const handleRevertCamera = (camId) => {
		setSaving(true)
		request(`/motion/sensitivity/${camId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reset: true })
		}, authPromiseHandler).then(res => {
			setSaving(false)
			if (res && !res.error) {
				const revertedVal = res.threshold ?? defaultThreshold
				setCameras(prev => prev.map(c => c.id === camId ? { ...c, threshold: revertedVal, isCustom: false } : c))
				setInitialCameras(prev => prev.map(c => c.id === camId ? { ...c, threshold: revertedVal, isCustom: false } : c))
				toast(res.motionRestarted === false ? t("admin.motion.savedRestartFailed") : t("admin.motion.reverted"))
			} else {
				toast(t("admin.motion.failed"))
			}
		})
	}

	const isDefaultChanged = defaultThreshold !== initialDefaultThreshold
	const isDefaultValid = Number.isInteger(Number(defaultThreshold)) && Number(defaultThreshold) >= 1

	return (
		<Card className="bg-surface border-border mt-4">
			<CardHeader className="pb-2">
				<CardTitle className="text-primary text-lg">{t("admin.motion.title")}</CardTitle>
				<p className="text-xs text-muted mt-1">{t("admin.motion.description")}</p>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="py-4 text-center text-sm text-muted">{t("common.loading")}</p>
				) : error ? (
					<p className="py-4 text-center text-sm text-danger">
						{t("admin.motion.loadFailed")}{" "}
						<button onClick={fetchSensitivity} className="underline hover:opacity-80">
							{t("common.retry")}
						</button>
					</p>
				) : cameras.length === 0 ? (
					<div className="space-y-4 pt-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-primary">{t("admin.motion.allCameras")}</span>
							<Button
								size="sm"
								disabled={saving || !isDefaultChanged || !isDefaultValid}
								onClick={handleSaveDefault}
								className="bg-accent text-accent-foreground hover:bg-accent/80"
							>
								{saving ? t("common.saving", "Saving…") : t("admin.motion.save")}
							</Button>
						</div>
						<div className="flex items-center gap-4">
							<div className="flex-1">
								<Slider
									min={MIN_THRESHOLD}
									max={MAX_THRESHOLD}
									step={50}
									value={[Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Number(defaultThreshold) || MIN_THRESHOLD))]}
									onValueChange={([val]) => setDefaultThreshold(val)}
									aria-label={t("admin.motion.title")}
								/>
								<div className="flex justify-between text-[11px] text-muted mt-1">
									<span>{t("admin.motion.moreSensitive")}</span>
									<span>{t("admin.motion.lessSensitive")}</span>
								</div>
							</div>
							<div className="w-28 shrink-0">
								<Input
									type="number"
									min="1"
									value={defaultThreshold}
									onChange={(e) => setDefaultThreshold(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
									className="text-right"
									aria-label={t("admin.motion.thresholdValue")}
								/>
							</div>
						</div>
					</div>
				) : (
					<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full pt-1">
						<TabsList className="mb-3 flex-wrap h-auto gap-1">
							<TabsTrigger value="default">{t("admin.motion.allCameras")}</TabsTrigger>
							{cameras.map(cam => (
								<TabsTrigger key={cam.id} value={String(cam.id)} className="flex items-center gap-1.5">
									<span>{cam.name}</span>
									{cam.isCustom && <span className="size-1.5 rounded-full bg-accent inline-block" title={t("admin.motion.customOverride")} />}
								</TabsTrigger>
							))}
						</TabsList>

						<TabsContent value="default" className="space-y-4 pt-1">
							<div className="flex items-center justify-between">
								<Badge variant="secondary">
									{t("admin.motion.allCameras")}
								</Badge>
								<Button
									size="sm"
									disabled={saving || !isDefaultChanged || !isDefaultValid}
									onClick={handleSaveDefault}
									className="bg-accent text-accent-foreground hover:bg-accent/80"
								>
									{saving ? t("common.saving", "Saving…") : t("admin.motion.save")}
								</Button>
							</div>
							<div className="flex items-center gap-4">
								<div className="flex-1">
									<Slider
										min={MIN_THRESHOLD}
										max={MAX_THRESHOLD}
										step={50}
										value={[Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Number(defaultThreshold) || MIN_THRESHOLD))]}
										onValueChange={([val]) => setDefaultThreshold(val)}
										aria-label={t("admin.motion.title")}
									/>
									<div className="flex justify-between text-[11px] text-muted mt-1">
										<span>{t("admin.motion.moreSensitive")}</span>
										<span>{t("admin.motion.lessSensitive")}</span>
									</div>
								</div>
								<div className="w-28 shrink-0">
									<Input
										type="number"
										min="1"
										value={defaultThreshold}
										onChange={(e) => setDefaultThreshold(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
										className="text-right"
										aria-label={t("admin.motion.thresholdValue")}
									/>
								</div>
							</div>
						</TabsContent>

						{cameras.map(cam => {
							const initialCam = initialCameras.find(c => c.id === cam.id)
							const isCamChanged = initialCam && (cam.threshold !== initialCam.threshold || cam.isCustom !== initialCam.isCustom)
							const isCamValid = Number.isInteger(Number(cam.threshold)) && Number(cam.threshold) >= 1

							return (
								<TabsContent key={cam.id} value={String(cam.id)} className="space-y-4 pt-1">
									<div className="flex items-center justify-between flex-wrap gap-2">
										<div className="flex items-center gap-2">
											<Badge variant={cam.isCustom ? "default" : "secondary"}>
												{cam.isCustom
													? t("admin.motion.customOverride")
													: `${t("admin.motion.usingDefault")} (${defaultThreshold})`}
											</Badge>
											{cam.isCustom && (
												<Button
													size="sm"
													variant="outline"
													disabled={saving}
													onClick={() => handleRevertCamera(cam.id)}
													className="text-xs h-7"
												>
													{t("admin.motion.revertToDefault")}
												</Button>
											)}
										</div>
										<Button
											size="sm"
											disabled={saving || !isCamChanged || !isCamValid}
											onClick={() => handleSaveCamera(cam.id)}
											className="bg-accent text-accent-foreground hover:bg-accent/80"
										>
											{saving ? t("common.saving", "Saving…") : t("admin.motion.save")}
										</Button>
									</div>

									<div className="flex items-center gap-4">
										<div className="flex-1">
											<Slider
												min={MIN_THRESHOLD}
												max={MAX_THRESHOLD}
												step={50}
												value={[Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Number(cam.threshold) || MIN_THRESHOLD))]}
												onValueChange={([val]) => handleCameraThresholdChange(cam.id, val)}
												aria-label={`${cam.name} sensitivity`}
											/>
											<div className="flex justify-between text-[11px] text-muted mt-1">
												<span>{t("admin.motion.moreSensitive")}</span>
												<span>{t("admin.motion.lessSensitive")}</span>
											</div>
										</div>
										<div className="w-28 shrink-0">
											<Input
												type="number"
												min="1"
												value={cam.threshold}
												onChange={(e) => handleCameraThresholdChange(cam.id, e.target.value === "" ? "" : parseInt(e.target.value, 10))}
												className="text-right"
												aria-label={`${cam.name} ${t("admin.motion.thresholdValue")}`}
											/>
										</div>
									</div>
								</TabsContent>
							)
						})}
					</Tabs>
				)}
			</CardContent>
		</Card>
	)
}

export default MotionSensitivity

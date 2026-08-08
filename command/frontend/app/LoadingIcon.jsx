import React from "react"
import { useTranslation } from "react-i18next"

const LoadingIcon = () => {
	const { t } = useTranslation()

	return (
		<div className="fixed left-1/2 top-1/2 size-[25vh] -translate-x-1/2 -translate-y-1/2">
			<img alt={t("common.loadingAlt")} src="/res/logo.png" className="spin h-full w-full object-contain" />
		</div>
	)
}

export default LoadingIcon

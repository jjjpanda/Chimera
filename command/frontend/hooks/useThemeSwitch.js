import { Modal } from 'antd'

import Cookies from "js-cookie"

const useThemeSwitch = () => {
    const isDarkTheme = Cookies.get('theme') == "dark"

    const switchTheme = () => {
        Cookies.set("theme", isDarkTheme ? "light" : "dark")
        window.location.reload(false);
    }

    const triggerSwitchModal = () => {
        Modal.confirm({
            title: `Switch to ${isDarkTheme ? "light" : "dark"} theme?`,
            okText: "No",
            cancelText: "Yes",
            onCancel: switchTheme
        })
    }

    return [isDarkTheme, switchTheme, triggerSwitchModal]
}

export default useThemeSwitch
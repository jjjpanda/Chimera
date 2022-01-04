import React from 'react'

import {Switch, Typography, Space} from 'antd'
import Cookies from "js-cookie"

const ThemeSwitcher = () => {
    return (
        <Space>
            <Typography>Dark Theme</Typography>
            <Switch 
                checked={Cookies.get('theme') == "dark"} 
                onChange={(checked) => {
                    Cookies.set("theme", checked ? "dark" : "light")
                    window.location.reload(false);
                }}
            />
        </Space>
    )
}

export default ThemeSwitcher
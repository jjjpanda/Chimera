import React from 'react'
import useThemeSwitch from '../hooks/useThemeSwitch'

import {Switch, Typography, Space} from 'antd'

const ThemeSwitch = (props) => {
    const [isDarkTheme, switchTheme] = useThemeSwitch();

    return (
        <Space>
            <Typography>Dark Theme</Typography>
            <Switch 
                checked={isDarkTheme} 
                onChange={switchTheme}
            />
        </Space>
    )
    
}

export default ThemeSwitch
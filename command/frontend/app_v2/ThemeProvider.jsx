import React, {useEffect} from 'react';
import useThemeSwitch from '../hooks/useThemeSwitch';

const ThemeProvider = ({children}) => {
    const [isDarkTheme] = useThemeSwitch();

    useEffect(() => {
        if( isDarkTheme ) {
            import('antd/dist/antd.dark.css')
        }
        else{
            import('antd/dist/antd.css')
        }
    })
    return (<div>{children}</div>)
}

export default ThemeProvider;
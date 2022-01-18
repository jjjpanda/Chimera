import React, {useEffect} from 'react';

import Cookies from "js-cookie"

const ThemeProvider = ({children}) => {
    useEffect(() => {
        if( Cookies.get('theme') == "dark" ) {
            import('antd/dist/antd.dark.css')
        }
        else{
            import('antd/dist/antd.css')
        }
    })
    return (<div>{children}</div>)
}

export default ThemeProvider;
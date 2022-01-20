import React from 'react';

import { useMediaQuery } from 'react-responsive'

import Main from './Main.jsx'
import MobileMain from './MobileMain.jsx'

const ResponsiveMain = (props) => {
    const isTabletOrMobile = useMediaQuery({ query: '(max-width: 600px)' }) 
    if(isTabletOrMobile){
        return(
            <MobileMain/>
        )
    }
    else{
        return(
            <Main/>    
        )
    }
}

export default ResponsiveMain
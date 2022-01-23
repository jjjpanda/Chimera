import React, { useState } from "react"
import useThemeSwitch from "../hooks/useThemeSwitch"
import { useNavigate } from "react-router-dom"

import { Layout, Menu } from "antd"
const { Sider } = Layout
import { TabBar } from "antd-mobile"
import { BulbFilled, BulbOutlined, HomeOutlined, VideoCameraOutlined, PlayCircleOutlined, HistoryOutlined, StockOutlined } from '@ant-design/icons'

import { indexToRoute } from "../js/routeIndexMapping"

const SideMenu = (props) => {
	const [collapsed, setCollapsed] = useState(true)
    const [isDarkTheme, switchTheme, triggerSwitchModal] = useThemeSwitch();
    const navigate = useNavigate()

    const handleMenuClick = (info) => { 
        console.log(info)
        let key = info && props.mobile ? info : info.key
		if(key == "theme"){
			triggerSwitchModal()
		}
        else if(props.index != key){
            navigate(indexToRoute(key))
        }
	}

    const tabs = [
        { key: "route-0", icon: <HomeOutlined />, title:"Chimera" },
        { key: "route-1", icon: <VideoCameraOutlined />, title:"Live" },
        { key: "route-2", icon: <PlayCircleOutlined />, title:"Processes" },
        { key: "route-3", icon: <HistoryOutlined />, title:"Scrubber" },
        { key: "route-4", icon: <StockOutlined />, title:"Stats" },
        { key: "theme", icon: isDarkTheme ? <BulbFilled /> : <BulbOutlined />, title:"Theme" },
    ]

    if(props.mobile){
        return (
            <TabBar activeKey={props.index} onChange={handleMenuClick}>
                {tabs.map(tab => (
                    <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
                ))}
            </TabBar>
        )
    }
    else{
        return (
            <Sider
                collapsible 
                collapsed={collapsed} 
                onCollapse={(c) => setCollapsed(c)}
            >
                <img 
                    style={{ display: "inherit", objectFit: "contain", height: "5%" }} 
                    src={"/res/logo.png"}
                />
                <Menu theme="dark" defaultSelectedKeys={[props.index]} onClick={handleMenuClick}>
                    {tabs.map((tab) => (
                        <Menu.Item key={tab.key} icon={tab.icon}>
                            {tab.title}
                        </Menu.Item>
                    ))}
                </Menu>
            </Sider>
        )
    }
}

export default SideMenu
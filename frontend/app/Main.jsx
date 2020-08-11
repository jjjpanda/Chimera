import React from 'react';

import { 
    Button,
    List    
} from 'antd-mobile';

class Main extends React.Component {
    render () {
        return (
            <List style={{ margin: '5px 0', backgroundColor: 'white' }}>
                <List.Item
                    extra={<Button type="ghost" size="small" inline>small</Button>}
                    multipleLine
                >
                    Example
                    <List.Item.Brief>
                        example of subtitle/description
                    </List.Item.Brief>
                </List.Item>
                
                <List.Item
                    extra={<Button type="primary" size="small" inline>small</Button>}
                    multipleLine
                >
                    Example
                    <List.Item.Brief>
                        example of subtitle/description
                    </List.Item.Brief>
                </List.Item>
            </List>
        )
    }
}

export default Main
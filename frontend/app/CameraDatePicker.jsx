import React from 'react';

import { 
    Flex,
    Modal, 
    Button,
    SegmentedControl,
    DatePicker,
    List,
    Checkbox,
    WhiteSpace,
    Toast
} from 'antd-mobile';

import enUs from 'antd-mobile/lib/date-picker/locale/en_US';

class CameraDatePicker extends React.Component {
    constructor(props){
        super(props)
    }

    render () {
        return (
            <List>
                {this.props.pre}

                <List.Item>
                    <div>Camera</div>
                    <SegmentedControl
                        selectedIndex={this.props.camera}
                        values={this.props.cameras}
                        onValueChange = {this.props.cameraChange}
                        tintColor={'#ff0000'}
                    />
                </List.Item>

                <DatePicker
                    value={this.props.startDate}
                    locale={enUs}
                    onChange={this.props.startChange}
                >
                    <List.Item arrow="horizontal">
                        Start Date
                    </List.Item>
                </DatePicker>
            
                <DatePicker
                    value={this.props.endDate}
                    locale={enUs}
                    onChange={this.props.endDate}
                >
                    <List.Item arrow="horizontal">
                        End Date
                    </List.Item>
                </DatePicker>
 
                {this.props.post}
            </List>
        )
    }
}

export default CameraDatePicker
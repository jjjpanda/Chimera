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
    Toast,
    InputItem
} from 'antd-mobile';

import enUs from 'antd-mobile/lib/date-picker/locale/en_US';

class TimeRangePicker extends React.Component{

    constructor(props){
        super(props)
    }

    render() {
        return [
            <DatePicker
                mode="time"
                value={this.props.startTime}
                locale={enUs}
                onChange={this.props.startChange}
                use12Hours
            >
                <List.Item arrow="horizontal">
                    Start Date
                </List.Item>
            </DatePicker>,
            <DatePicker
                mode='time'
                value={this.props.endTime}
                locale={enUs}
                onChange={this.props.endChange}
                use12Hours
            >
                <List.Item arrow="horizontal">
                    End Date
                </List.Item>
            </DatePicker>
        ]
    }
}

export default TimeRangePicker
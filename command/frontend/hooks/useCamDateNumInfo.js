import {useEffect, useState} from 'react';
import moment from "moment"

const useCamDateNumInfo = (extraOverride) => {
    const [info, setInfo] = useState({
		camera: 0,
		cameras: JSON.parse(process.env.cameras),

		startDate: moment().subtract(1, "day"),
		endDate: moment(),

        number: 1,
        numberType: null,
        disabled: false,
        ...extraOverride
    })

    return [info, setInfo]
}

export default useCamDateNumInfo;
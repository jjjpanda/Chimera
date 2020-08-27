const moment = require('moment')

const cronString = (weekdays, date) => {
    const momentDate = moment(date)
    const weekdaysArray = Object.entries(weekdays).filter(([weekday, selected]) => selected).map(([weekday, selected]) => {
        return weekday
    })
    return `${momentDate.format('m')} ${momentDate.format('k')} * * ${weekdaysArray.join('').length > 0 ? weekdaysArray.join(',') : "*"}`
}

export default cronString 
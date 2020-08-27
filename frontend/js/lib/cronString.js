const moment = require('moment')

const cronString = (weekdays, date) => {
    const momentDate = moment(date)
    const weekdaysArray = Object.entries(weekdays).filter(([weekday, selected]) => selected).map(([weekday, selected]) => {
        return weekday
    })
    return `${momentDate.format('m')} ${momentDate.format('H')} * * ${weekdaysArray.join('').length > 0 ? weekdaysArray.join(',') : "*"}`
}

const cronState = (str) => {
    let weekdays = {
        Sunday:     false,
        Monday:     false,
        Tuesday:    false,
        Wednesday:  false,
        Thursday:   false,
        Friday:     false,
        Saturday:   false,
    }
    if(str == undefined){
        return {
            weekdays,
            date: moment().toDate(),
            running: false
        }
    }
    else{
        const cronParts = str.split(' ')
        const minute = parseInt(cronParts[0])
        const hour = parseInt(cronParts[1])
        if(cronParts[4] != "*"){
            cronParts[4].split(',').forEach((weekday) => {
                weekdays[weekday] = true
            })
        }
        else{
            weekdays = {
                Sunday:     true,
                Monday:     true,
                Tuesday:    true,
                Wednesday:  true,
                Thursday:   true,
                Friday:     true,
                Saturday:   true,
            }
        }
        return {
            date: moment().hour(hour).minute(minute).toDate(),
            weekdays,
            running: true,
        }
    }
}

export { cronString, cronState } 
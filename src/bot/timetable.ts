const min = 60;
const hour =60 * min;
const day = 24 * hour;
const week = 7 * day;
const month = 30 * day;

export const Timetable = [
    { name: '3 mins', time: 3 * min },
    { name: '1 hr 50 mins', time: hour + 50 * min },
    { name: '3 hrs 20 mins', time: 3 * hour + 20 * min },
    { name: '13 hrs', time: 13 * hour },
    { name: '1 d 2 hrs', time: day + 2 * hour },
    { name: '2 d 8 hrs', time: 2 * day + 8 * hour },
    // skipMessage is required if delay between messages > 30 days, it will not be sent to user
    { name: '4 d', time: 4 * day, skipMessage: true },
    { name: '1 w', time: week },
];
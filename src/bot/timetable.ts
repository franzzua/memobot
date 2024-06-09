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
    { name: '1 w', time: week },
];

export const TimetableDelay = 3 * min;

export function now(){
    return Math.round((+new Date())/1000);
}

export const Timetable = [
    { index: 0, time: 4, name: '4s'},
    { index: 1, time: 11, name: '11s'},
    { index: 2, time: 29, name: '29s'},
    { index: 3, time: 1*60, name: '1m'},
    { index: 4, time: 3*60, name: '3m'},
    { index: 5, time: 7*60, name: '7m'},
]

const min = 60;
const hour =60 * min;
const day = 24 * hour;
const week = 7 * day;
const month = 30 * day;

export const TimetableProd = [
    { index: 0, time: 42*min, name: '42 mins'},
    { index: 1, time: 24*hour, name: '24 hrs'},
    { index: 2, time: 42*hour, name: '42 hrs'},
    { index: 3, time: week, name: '1 w'},
    { index: 4, time: 2*week, name: '2 w'},
    { index: 5, time: month, name: '1 m'},
    { index: 5, time: 2*month, name: '2 m'},
]
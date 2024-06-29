import { env } from "../env";

export const min = 60;
export const hour =60 * min;
export const day = 24 * hour;
export const week = 7 * day;
export const month = 30 * day;

const DevTimetable = [
    { name: '3 mins', time: 3 * min },
    { name: '1 hr 50 mins', time: hour + 50 * min },
    { name: '3 hrs 20 mins', time: 3 * hour + 20 * min },
    { name: '13 hrs', time: 13 * hour },
    { name: '1 d 2 hrs', time: day + 2 * hour },
    { name: '2 d 8 hrs', time: 2 * day + 8 * hour },
    { name: '1 w', time: week },
];

const ProdTimetable = [
    { name: '42 mins', time: 42 * min },
    { name: '24 hrs', time: 24 * hour },
    { name: '42 hrs', time: 42 * hour },
    { name: '1 w', time: week },
    { name: '2 w', time: 2 * week },
    { name: '1 m', time: month },
    { name: '3 m', time: 3 * month },
];

export const Timetable = env.IsProd ? ProdTimetable : DevTimetable;
export const TimetableDelay =  env.IsProd ? 42 * min : 3 * min;

export function now(){
    return Math.round((+new Date())/1000);
}

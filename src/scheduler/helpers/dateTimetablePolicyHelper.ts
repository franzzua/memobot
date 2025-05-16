import {DateTimetable} from "../types";
import {TimetableHelper} from "./timetable.helper";

export class DateTimetablePolicyHelper implements TimetableHelper {
    constructor(private timetable: DateTimetable) {
    }

    getNextTimeAfter(from: Date): Date | null {
        let min: Date | null = null;
        for (let date of this.timetable.dates) {
            if (date <= from) continue;
            if (!min || date < min) min = date;
        }
        return min;
    }

    getTimesBetween(after: Date, before: Date) {
        return this.timetable.dates.filter(x => x > after && x <= before);
    }
}
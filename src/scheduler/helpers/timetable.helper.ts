import {BaseTimetable, Timetable, TimetablePolicyType} from "../types";
import {DateTimetablePolicyHelper} from "./dateTimetablePolicyHelper";

export abstract class TimetableHelper {

    abstract getNextTimeAfter(from: Date): Date | null;

    abstract getTimesBetween(after: Date, before: Date): Date[];

    public static get(timetable: BaseTimetable): TimetableHelper {
        switch (timetable.type) {
            case TimetablePolicyType.Dates:
                return new DateTimetablePolicyHelper(timetable);
            default:
                throw new Error(`Unknown timetable type "${timetable.type}"`);
        }
    }
}

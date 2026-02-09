export type Timetable = {
    id: any;
} & BaseTimetable;

export type BaseTimetable = DateTimetable;

export type DateTimetable = {
    type: TimetablePolicyType.Dates;
    dates: Date[];
}
export const enum TimetablePolicyType {
    Dates = 1,
}
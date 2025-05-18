import {Timestamp} from "@google-cloud/firestore";

export function fixTimestamps(value: unknown) {
    if (!value) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(fixTimestamps);
    const res = {} as any;
    for (let key in value) {
        res[key] = fixTimestamps(value[key]);
    }
    return res;
}
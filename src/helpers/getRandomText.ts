import texts from "../texts.json" with { type: "json" };
import {crc32} from "node:zlib";

const modulo = 137;

export function getText(command: keyof typeof texts, index: number, replace?: string | number): string {
    return texts[command][index].replace('{...}', replace?.toString() ?? '');
}
export function getAllText(command: keyof typeof texts, replace?: string | number): string {
    return texts[command].join('\n').replace('{...}', replace?.toString() ?? '');
}
export function getRandomText(command: keyof typeof texts, uid: string | number, seed: number, replace?: string | number): string {
    const arr = texts[command];
    const index = (uidToNumber(uid) + seed) % modulo;
    return arr[index % arr.length].replace('{...}', replace?.toString() ?? '');
}

function uidToNumber(uid: string  | number) {
    if (typeof uid === "number") return uid;
    return crc32(uid);
}
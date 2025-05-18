import {AggregateField, CollectionReference, Filter} from "@google-cloud/firestore";
import {Logger} from "../logger/logger";
import {TimetableEntity} from "../scheduler/storage/schedulerStorage";
import {Message} from "../types";
import {fixTimestamps} from "./fixTimestamps";
import {DateTimetable} from "../scheduler/types";

export class MessagesDatabase {
    constructor(private messages: CollectionReference) {
    }

    @Logger.measure
    async addTimetable(timetable: TimetableEntity<MessageTimetable>): Promise<void> {
        if (timetable.id)
            await this.messages.doc(timetable.id).set(timetable);
        else
            await this.messages.add(timetable);
    }

    @Logger.measure
    async getTimetablesBefore(to: Date): Promise<TimetableEntity<MessageTimetable>[]> {
        const result = await this.messages.where(Filter.and(
            Filter.where('next', '<=', to),
        )).get();
        return result.docs.map(x => fixTimestamps(x.data()) as TimetableEntity<MessageTimetable>);
    }

    @Logger.measure
    async getNextTimetableTime(): Promise<Date | null> {
        const result = await this.messages
            .orderBy('next', 'asc').limit(1).select('next').get();
        return fixTimestamps(result.docs[0]?.data().next) ?? null;
    }

    @Logger.measure
    async getMaxNumber() {
        const result = await this.messages.aggregate({
            max: AggregateField.count()
        }).get();
        return result.data().max;
    }

    @Logger.measure
    async deleteMessage(number: number) {
        const id = await this.messages.where(Filter.and(
            Filter.where('number', '==', number),
        )).select('id').limit(1).get();
        await this.messages.doc(id.docs[0].id).set({
            deleted: true,
        }, {merge: true})
    }

    @Logger.measure
    async updateTimetable(id: string, patch: Partial<MessageTimetable>): Promise<void> {
        await this.messages.doc(id).set(patch, {merge: true});
    }

    @Logger.measure
    async removeAllMessages() {
        const docs = await this.messages.listDocuments();
        for (let doc of docs) {
            await doc.delete();
        }
    }

    @Logger.measure
    queryMessages(isActive: boolean) {
        return this.messages.where(Filter.and(
            Filter.where('next', isActive ? '!=' : '==', null)
        )).get().then(x => x.docs.map(x => x.data() as Message));
    }
}
export type MessageTimetable = Message & DateTimetable

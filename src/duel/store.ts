import type {DuelState} from "./engine";
import type {PrismaClient} from "../../prisma/client";

export type DuelStatus = 'waiting' | 'active' | 'over';
export type DuelRecord = {
    id: string;
    player0: string;
    name0: string;
    player1: string | null;
    name1: string | null;
    vsBot: boolean;
    status: DuelStatus;
    state: DuelState;
    // Telegram message id of the last "your move" message sent to each player, so the
    // next one replaces it instead of piling up in the chat.
    notifications: [number | null, number | null];
    version: number;
    updatedAt: Date;
};
export type NewDuel = Omit<DuelRecord, 'id' | 'version' | 'updatedAt'>;

export interface DuelStore {
    create(duel: NewDuel): Promise<DuelRecord>;
    get(id: string): Promise<DuelRecord | null>;
    /** Saves only if nobody saved since `duel.version` was read; bumps the version. */
    save(duel: DuelRecord): Promise<boolean>;
    listFor(userId: string, limit: number): Promise<DuelRecord[]>;
}

function fromRow(row: any): DuelRecord {
    return {
        ...row,
        status: row.status as DuelStatus,
        state: row.state as DuelState,
        notifications: (row.notifications as [number | null, number | null] | null) ?? [null, null],
    };
}

export class PrismaDuelStore implements DuelStore {
    constructor(private prisma: PrismaClient) {
    }

    async create(duel: NewDuel) {
        return fromRow(await this.prisma.duel.create({data: {...duel, state: duel.state as any}}));
    }

    async get(id: string) {
        const row = await this.prisma.duel.findUnique({where: {id}}).catch(() => null);
        return row ? fromRow(row) : null;
    }

    async save(duel: DuelRecord) {
        const {count} = await this.prisma.duel.updateMany({
            where: {id: duel.id, version: duel.version},
            data: {
                player1: duel.player1,
                name1: duel.name1,
                status: duel.status,
                state: duel.state as any,
                notifications: duel.notifications as any,
                version: {increment: 1},
            },
        });
        if (count) duel.version++;
        return count > 0;
    }

    async listFor(userId: string, limit: number) {
        const rows = await this.prisma.duel.findMany({
            where: {OR: [{player0: userId}, {player1: userId}]},
            orderBy: {updatedAt: 'desc'},
            take: limit,
        });
        return rows.map(fromRow);
    }
}

/** In-memory store for specs and local previews. */
export class MemoryDuelStore implements DuelStore {
    private rows = new Map<string, DuelRecord>();
    private seq = 0;

    async create(duel: NewDuel) {
        const rec = structuredClone({...duel, id: `duel${++this.seq}`, version: 0, updatedAt: new Date()});
        this.rows.set(rec.id, rec);
        return structuredClone(rec);
    }

    async get(id: string) {
        const rec = this.rows.get(id);
        return rec ? structuredClone(rec) : null;
    }

    async save(duel: DuelRecord) {
        const cur = this.rows.get(duel.id);
        if (!cur || cur.version !== duel.version) return false;
        duel.version++;
        duel.updatedAt = new Date();
        this.rows.set(duel.id, structuredClone(duel));
        return true;
    }

    async listFor(userId: string, limit: number) {
        return [...this.rows.values()]
            .filter(r => r.player0 === userId || r.player1 === userId)
            .sort((a, b) => +b.updatedAt - +a.updatedAt)
            .slice(0, limit)
            .map(r => structuredClone(r));
    }
}

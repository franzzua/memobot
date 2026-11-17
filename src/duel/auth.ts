import {createHmac, timingSafeEqual} from "node:crypto";

export type TelegramUser = { id: string; name: string };

/**
 * Checks Telegram Mini App initData (the signed query string Telegram hands the page) and
 * returns the user it was issued for, or null when the signature, the age or the user is
 * wrong. https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
    initData: unknown,
    botToken: string,
    maxAgeSec = 24 * 3600,
    now = Date.now(),
): TelegramUser | null {
    if (typeof initData !== 'string' || !initData) return null;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
    params.delete('hash');
    const dataCheck = [...params.entries()]
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected = createHmac('sha256', secret).update(dataCheck).digest();
    if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) return null;

    try {
        const user = JSON.parse(params.get('user') ?? 'null');
        if (!user?.id) return null;
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Player';
        return {id: String(user.id), name};
    } catch {
        return null;
    }
}

/** Signs initData the way Telegram does. For specs and local previews only. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
    const dataCheck = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
    return new URLSearchParams({...fields, hash}).toString();
}

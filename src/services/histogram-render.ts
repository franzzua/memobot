import {Canvas, createCanvas, CanvasRenderingContext2D} from "canvas";

// Word repetition steps in send order (mirrors WordSendHandlers in word-send-handlers.ts):
// index 0 of a word's `dates` is always the intro (newWords); indices 1..N map here.
export const REPETITION_TYPES = ['wordQuiz', 'voice', 'image', 'card', 'example'] as const;
export type RepetitionType = typeof REPETITION_TYPES[number];

export type HistogramBucket = {
    day: Date;
    newWords: number;
    wordQuiz: number;
    voice: number;
    image: number;
    card: number;
    example: number;
    quizzes: number;
};

function emptyBucket(day: Date): HistogramBucket {
    return {day, newWords: 0, wordQuiz: 0, voice: 0, image: 0, card: 0, example: 0, quizzes: 0};
}

const dayMs = 86400 * 1000;

function dayKey(d: Date): number {
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / dayMs);
}

export function bucketPlanByDay(
    words: Array<{dates: Date[]}>,
    quizzes: Array<{date: Date}>,
): HistogramBucket[] {
    const map = new Map<number, HistogramBucket>();
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000;
    const touch = (d: Date): HistogramBucket => {
        const k = dayKey(d);
        let b = map.get(k);
        if (!b) {
            b = emptyBucket(new Date(k * dayMs + tzOffsetMs));
            map.set(k, b);
        }
        return b;
    };

    for (const w of words) {
        const sorted = [...w.dates].sort((a, b) => +a - +b);
        for (let i = 0; i < sorted.length; i++) {
            const b = touch(sorted[i]);
            if (i === 0) {
                b.newWords += 1;
            } else {
                const type = REPETITION_TYPES[i - 1];
                if (type) b[type] += 1;
            }
        }
    }
    for (const q of quizzes) {
        touch(q.date).quizzes += 1;
    }

    if (map.size === 0) return [];
    const keys = [...map.keys()].sort((a, b) => a - b);
    const out: HistogramBucket[] = [];
    for (let k = keys[0]; k <= keys[keys.length - 1]; k++) {
        out.push(map.get(k) ?? emptyBucket(new Date(k * dayMs + tzOffsetMs)));
    }
    return out;
}

export function renderPlanHistogram(
    words: Array<{dates: Date[]}>,
    quizzes: Array<{date: Date}>,
): Buffer {
    const buckets = bucketPlanByDay(words, quizzes);
    const title = `${buckets.length} days · ${words.length} words · ${quizzes.length} quizzes`;
    return new HistogramRender(buckets, title).render();
}

const COLOR_NEW = '#D8443A';
const COLOR_WORD_QUIZ = '#E8A23C';
const COLOR_VOICE = '#4FA8A0';
const COLOR_IMAGE = '#3E7CB1';
const COLOR_CARD = '#8A4FBF';
const COLOR_EXAMPLE = '#C2588A';
const COLOR_QUIZ = '#5B8C3A';
const COLOR_AXIS = '#444';
const COLOR_GRID = '#DDD';
const COLOR_BG = '#FFF';

// Stacking order (bottom to top) and color for each layer of the plan histogram.
const STACK: Array<{key: keyof Omit<HistogramBucket, 'day'>; label: string; color: string}> = [
    {key: 'newWords', label: 'new', color: COLOR_NEW},
    {key: 'wordQuiz', label: 'wordQuiz', color: COLOR_WORD_QUIZ},
    {key: 'voice', label: 'voice', color: COLOR_VOICE},
    {key: 'image', label: 'image', color: COLOR_IMAGE},
    {key: 'card', label: 'card', color: COLOR_CARD},
    {key: 'example', label: 'example', color: COLOR_EXAMPLE},
    {key: 'quizzes', label: 'quiz', color: COLOR_QUIZ},
];

export class HistogramRender {
    private width = 640;
    private height = 480;
    private padLeft = 40;
    private padRight = 16;
    private padTop = 24;
    private padBottom = 48;

    constructor(private buckets: HistogramBucket[], private title: string) {
        this.smoothed = smoothBuckets(buckets, 7);
    }

    private smoothed: HistogramBucket[];

    render(): Buffer {
        const canvas: Canvas = createCanvas(this.width, this.height);
        const ctx: CanvasRenderingContext2D = canvas.getContext('2d');

        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(0, 0, this.width, this.height);

        const plotW = this.width - this.padLeft - this.padRight;
        const plotH = this.height - this.padTop - this.padBottom;

        const maxTotal = Math.max(1, ...this.smoothed.map(b => STACK.reduce((sum, s) => sum + b[s.key], 0)));
        const yTicks = niceTicks(maxTotal, 5);
        const yMax = yTicks[yTicks.length - 1];

        ctx.fillStyle = COLOR_AXIS;
        ctx.font = '14px sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(this.title, this.padLeft, 4);

        ctx.strokeStyle = COLOR_GRID;
        ctx.lineWidth = 1;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = COLOR_AXIS;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        for (const t of yTicks) {
            const y = this.padTop + plotH - (t / yMax) * plotH;
            ctx.beginPath();
            ctx.moveTo(this.padLeft, y);
            ctx.lineTo(this.padLeft + plotW, y);
            ctx.stroke();
            ctx.fillText(String(t), this.padLeft - 4, y);
        }

        ctx.strokeStyle = COLOR_AXIS;
        ctx.beginPath();
        ctx.moveTo(this.padLeft, this.padTop);
        ctx.lineTo(this.padLeft, this.padTop + plotH);
        ctx.lineTo(this.padLeft + plotW, this.padTop + plotH);
        ctx.stroke();

        const n = this.smoothed.length;
        const slot = plotW / Math.max(1, n);
        const baselineY = this.padTop + plotH;
        const xs = this.smoothed.map((_, i) => this.padLeft + (i + 0.5) * slot);
        const toY = (v: number) => baselineY - (v / yMax) * plotH;

        let running = this.smoothed.map(() => 0);
        const layers: Array<{top: number[]; bottom: number[] | null; color: string}> = STACK.map((s, idx) => {
            const bottom = idx === 0 ? null : running;
            const top = this.smoothed.map((b, i) => running[i] + b[s.key]);
            running = top;
            return {top, bottom, color: s.color};
        });
        for (const layer of layers) {
            ctx.beginPath();
            const upper = xs.map((x, i) => ({x, y: toY(layer.top[i])}));
            tracePath(ctx, upper, false);
            if (layer.bottom) {
                const lower = xs.map((x, i) => ({x, y: toY(layer.bottom![i])})).reverse();
                tracePath(ctx, lower, true);
            } else {
                ctx.lineTo(xs[xs.length - 1], baselineY);
                ctx.lineTo(xs[0], baselineY);
            }
            ctx.closePath();
            ctx.fillStyle = layer.color;
            ctx.fill();
        }

        ctx.fillStyle = COLOR_AXIS;
        ctx.font = '10px sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        const labelStep = Math.max(1, Math.ceil(n / 10));
        for (let i = 0; i < n; i += labelStep) {
            const x = this.padLeft + i * slot + slot / 2;
            const d = this.smoothed[i].day;
            const label = `${d.getMonth() + 1}/${d.getDate()}`;
            ctx.fillText(label, x, this.padTop + plotH + 6);
        }

        const legendY = this.height - 18;
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        let lx = this.padLeft;
        for (const it of STACK) {
            ctx.fillStyle = it.color;
            ctx.fillRect(lx, legendY - 5, 12, 10);
            ctx.fillStyle = COLOR_AXIS;
            ctx.fillText(it.label, lx + 16, legendY);
            lx += 16 + ctx.measureText(it.label).width + 16;
        }

        return canvas.toBuffer();
    }
}

function tracePath(ctx: CanvasRenderingContext2D, points: Array<{x: number; y: number}>, continuePath: boolean): void {
    if (points.length === 0) return;
    if (continuePath) ctx.lineTo(points[0].x, points[0].y);
    else ctx.moveTo(points[0].x, points[0].y);
    if (points.length < 3) {
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        return;
    }
    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
}

const SUM_KEYS = ['newWords', 'wordQuiz', 'voice', 'image', 'card', 'example', 'quizzes'] as const;

function smoothBuckets(buckets: HistogramBucket[], window: number): HistogramBucket[] {
    if (buckets.length === 0) return buckets;
    const half = Math.floor(window / 2);
    return buckets.map((_, i) => {
        const sums: Record<typeof SUM_KEYS[number], number> = {
            newWords: 0, wordQuiz: 0, voice: 0, image: 0, card: 0, example: 0, quizzes: 0,
        };
        let count = 0;
        for (let j = i - half; j <= i + half; j++) {
            if (j < 0 || j >= buckets.length) continue;
            for (const k of SUM_KEYS) sums[k] += buckets[j][k];
            count++;
        }
        for (const k of SUM_KEYS) sums[k] /= count;
        return {day: buckets[i].day, ...sums};
    });
}

function niceTicks(max: number, count: number): number[] {
    if (max <= 0) return [0, 1];
    const rawStep = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let step: number;
    if (norm <= 1) step = 1;
    else if (norm <= 2) step = 2;
    else if (norm <= 5) step = 5;
    else step = 10;
    step *= mag;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step / 2; v += step) {
        ticks.push(Math.round(v * 1000) / 1000);
    }
    return ticks;
}

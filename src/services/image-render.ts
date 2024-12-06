import { Canvas, createCanvas, registerFont, CanvasRenderingContext2D } from "canvas";

class Helper {
    public static Instance = new Helper();
    private readonly canvas!: Canvas;
    private readonly context!: CanvasRenderingContext2D;
    private width = 512;
    private height = 812;

    public font = 'Gloria Hallelujah';

    private constructor() {
        registerFont('./assets/GloriaHallelujah-Regular.ttf', {family: this.font});
        this.canvas = createCanvas(this.width, this.height);
        this.context = this.canvas.getContext('2d');
    }

    getWidth(text: string, fontSize: number) {
        this.context.font = `${fontSize}px "${this.font}"`;
        return this.context.measureText(text).width;
    }
}

type Style = {
    bg: string;
    color: string;
    fontSize: number;
    margin: number;
}
export class ImageRender {

    private width = 512;
    private height = 812;
    private headerStyle: Style = {
        bg: '#A45',
        color: '#AAA',
        fontSize: 80,
        margin: 8,
    };
    private style: Style = {
        bg: '#DAA',
        color: '#444',
        fontSize: 48,
        margin: 8,
    };
    private margin = 16;

    constructor(private title: string,
                private text: string) {
    }

    public render() {
        const header = new TextBlock(this.title, this.headerStyle, this.width - this.margin * 2, false);
        const content = new TextBlock(this.text, this.style, this.width - this.margin * 2, true);

        const height = header.height + content.height;
        const canvas = new Context(this.width, height);
        canvas.drawText(header, this.margin, 0);
        canvas.drawText(content, this.margin, header.height);
        return canvas.canvas.createPNGStream();
    }

}

class Context {

    public readonly canvas: Canvas = createCanvas(this.width, this.height)
    private readonly context: CanvasRenderingContext2D = this.canvas.getContext('2d');

    constructor(private width, private height) {
    }

    public drawText(block: TextBlock,
                     left: number,
                     top: number) {
        this.context.textBaseline = 'middle';
        this.context.font = `${block.style.fontSize}px "${Helper.Instance.font}"`;
        let y = top;
        this.context.fillStyle = block.style.bg;
        this.context.fillRect(0, top, this.width, block.height);
        if (block.divider) {
            this.drawDivider(left / 2, y + block.lineHeight / 8, block.style.color);
        }
        this.context.fillStyle = block.style.color;
        for (let headerLine of block.lines) {
            this.context.fillText(headerLine, left, y + block.lineHeight / 2);
            y += block.lineHeight;
            if (block.divider) {
                this.drawDivider(left / 2, y + block.lineHeight / 8, block.style.color);
            }
        }
        return y - top;
    }

    private drawDivider(x: number, y: number, color: string) {
        this.drawLine(
            x, y,
            this.width - x, y,
            color
        );
    }

    private drawLine(x1: number, y1: number, x2: number, y2: number, color: string) {
        this.context.strokeStyle = color;
        this.context.beginPath();
        this.context.moveTo(x1, y1);
        this.context.lineTo(x2, y2);
        this.context.closePath();
        this.context.stroke();
    }

}

class TextBlock {
    constructor(private text: string,
                public style: Style,
                private width: number,
                public divider: boolean) {
    }

    public lines = this.getLines(this.text, this.style.fontSize);
    public lineHeight = this.style.fontSize + this.style.margin
    public height = this.lines.length * this.lineHeight + (this.divider ? this.style.margin : 0);

    private getLines(text: string, fontSize: number) {
        const words = text.split(' ');
        const spaceWidth = Helper.Instance.getWidth(' ', fontSize);
        const maxWidth = this.width;
        const lines: string[][] = [[]];
        let position = 0;
        for (let word of words) {
            const width = Helper.Instance.getWidth(word, fontSize);
            if (position + width > maxWidth) {
                lines.push([]);
                lines.at(-1)!.push(word);
                position = width + spaceWidth;
            } else {
                position += width + spaceWidth;
                lines.at(-1)!.push(word);
            }
        }
        return lines.map(x => x.join(' '));
    }

}
import { Canvas, createCanvas, registerFont, CanvasRenderingContext2D } from "canvas";

class Helper {
    public static Instance = new Helper();
    private readonly canvas!: Canvas;
    private readonly context!: CanvasRenderingContext2D;

    private constructor() {
        registerFont('./assets/Lexend-Bold.ttf', {family: 'Lexend', weight: 'bold'});
        registerFont('./assets/Nunito-Regular.ttf', {family: 'Nunito'});
        this.canvas = createCanvas(512, 256);
        this.context = this.canvas.getContext('2d');
    }

    getWidth(text: string, fontSize: number, font: string, bold: boolean) {
        this.context.font = `${bold ? 'bold ' : ''}${fontSize}px "${font}"`;
        return this.context.measureText(text).width;
    }
}

type Style = {
    bg: string;
    color: string;
    fontSize: number;
    margin: number;
    font: string;
    bold: boolean;
}

export class ImageRender {

    private width = 512;
    private headerStyle: Style = {
        bg: '#209dba',
        color: '#ffffff',
        fontSize: 16,
        margin: 8,
        font: 'Lexend',
        bold: true,
    };
    private style: Style = {
        bg: '#e8f5f8',
        color: '#041013',
        fontSize: 14,
        margin: 8,
        font: 'Nunito',
        bold: false,
    };
    private margin = 16;

    constructor(private title: string,
                private text: string) {
    }

    public render() {
        const header = new TextBlock(this.title, this.headerStyle, this.width - this.margin * 2, false, 3);
        const content = new TextBlock(this.text, this.style, this.width - this.margin * 2, true);

        const height = header.height + content.height;
        const canvas = new Context(this.width, height);
        canvas.drawText(header, this.margin, 0);
        canvas.drawText(content, this.margin, header.height);
        return canvas.canvas.toBuffer();
    }

}

class Context {

    public readonly canvas: Canvas;
    private readonly context: CanvasRenderingContext2D;

    constructor(private width: number, private height: number) {
        this.canvas = createCanvas(width, height);
        this.context = this.canvas.getContext('2d');
    }

    public drawText(block: TextBlock,
                     left: number,
                     top: number) {
        this.context.textBaseline = 'middle';
        this.context.font = `${block.style.bold ? 'bold ' : ''}${block.style.fontSize}px "${block.style.font}"`;
        let y = top;
        this.context.fillStyle = block.style.bg;
        this.context.fillRect(0, top, this.width, block.height);
        if (block.divider) {
            this.drawDivider(left / 2, y + block.lineHeight / 8, block.style.color);
        }
        this.context.fillStyle = block.style.color;
        for (let line of block.lines) {
            this.context.fillText(line, left, y + block.lineHeight / 2);
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
    public style: Style;
    public lines: string[];
    public lineHeight: number;
    public height: number;

    constructor(private text: string,
                style: Style,
                private width: number,
                public divider: boolean,
                maxLines?: number) {
        this.style = maxLines !== undefined ? this.adjustFontSize(style, maxLines) : style;
        this.lines = this.getLines(this.text, this.style.fontSize, this.style.font, this.style.bold);
        this.lineHeight = this.style.fontSize + this.style.margin;
        this.height = this.lines.length * this.lineHeight + (divider ? this.style.margin : 0);
    }

    private adjustFontSize(style: Style, maxLines: number): Style {
        let fontSize = style.fontSize;
        const minFontSize = 10;
        while (fontSize > minFontSize) {
            const lines = this.getLines(this.text, fontSize, style.font, style.bold);
            if (lines.length <= maxLines) break;
            fontSize--;
        }
        return { ...style, fontSize };
    }

    private getLines(text: string, fontSize: number, font: string, bold: boolean): string[] {
        const words = text.split(' ');
        const spaceWidth = Helper.Instance.getWidth(' ', fontSize, font, bold);
        const maxWidth = this.width;
        const lines: string[][] = [[]];
        let position = 0;
        for (const word of words) {
            const width = Helper.Instance.getWidth(word, fontSize, font, bold);
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

import { Canvas, createCanvas, registerFont, CanvasRenderingContext2D } from "canvas";
export class ImageRender {
    private width = 512;
    private height = 512;
    public readonly canvas!: Canvas;
    private readonly context!: CanvasRenderingContext2D;
    private bg = '#DAA';
    private color = '#444';
    private headerBg = '#A45';
    private headerColor = '#AAA'
    private fontSize = 96;
    private margin = 16;
    private lineHeight = this.fontSize + this.margin;

    private font = 'Gloria Hallelujah';

    constructor(private title: string,
                private text: string) {
        registerFont('./assets/GloriaHallelujah-Regular.ttf', { family: this.font })
        this.canvas = createCanvas(this.width, this.height);
        this.context = this.canvas.getContext('2d');
        this.context.font = `${this.lineHeight - 2* this.margin}px "${this.font}"`;
        this.context.textBaseline = 'middle';
    }

    public render(){
        let line = 0;
        const headerLines = this.getLines(this.title);
        this.context.fillStyle = this.headerBg;
        this.context.fillRect(0, 0, this.width, this.lineHeight * headerLines.length);
        this.context.fillStyle = this.headerColor;
        for (let headerLine of headerLines) {
            this.context.fillText(headerLine, this.margin, (line + 1/2)*this.lineHeight);
            line++;
        }
        this.context.fillStyle = this.bg;
        this.context.fillRect(0, this.lineHeight * headerLines.length, this.width, this.height - this.lineHeight * headerLines.length);
        this.context.fillStyle = this.color;
        this.context.strokeStyle = this.color;
        this.context.beginPath();
        this.context.moveTo(this.margin / 2, (line + 1/8)*this.lineHeight);
        this.context.lineTo(this.width - this.margin / 2, (line + 1/8)*this.lineHeight);
        this.context.stroke();
        this.context.closePath();
        const bodyLines = this.getLines(this.text)
        for (let bodyLine of bodyLines) {
            this.context.fillText(bodyLine, this.margin, (line + 1/2+1/16)*this.lineHeight);
            line++;
            this.context.beginPath();
            this.context.moveTo(this.margin / 2, (line + 1/8)*this.lineHeight);
            this.context.lineTo(this.width - this.margin / 2, (line + 1/8)*this.lineHeight);
            this.context.stroke();
            this.context.closePath();
        }
    }

    private getLines(text: string){
        const words = text.split(' ');
        const spaceWidth = this.context.measureText(' ');
        const maxWidth = this.width - this.margin * 2;
        const lines: string[][] = [[]];
        let position = 0;
        for (let word of words) {
            const measure = this.context.measureText(word);
            if (position + measure.width > maxWidth){
                lines.push([]);
                lines.at(-1)!.push(word);
                position = measure.width + spaceWidth.width;
            } else {
                position += measure.width + spaceWidth.width;
                lines.at(-1)!.push(word);
            }
        }
        return lines.map(x => x.join(' '));
    }

    public toDataUrl(){
        return this.canvas.toDataURL();
    }
}
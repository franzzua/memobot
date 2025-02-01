import process from "node:process";
import {
    AudioMessage, ChatEvent, IncomingMessageEvent,
    Message,
    MessageOptions,
    Messenger,
    TextMessage
} from "./messenger";

export class WhatsAppMessenger extends Messenger {

    name = 'whatsapp';
    private baseApi = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;

    constructor(private phoneNumberId: string,
                private token: string,
                private apiVersion = 'v22.0') {
        super();
    }

    private accessToken: {
        token: string;
        expires_at: Date;
    } | undefined;

    async init() {
        // await this.register();
    }

    private async getAcccessToken() {
        if (this.accessToken && this.accessToken.expires_at > new Date())
            return this.accessToken.token;
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: process.env.FB_APP_ID!,
            client_secret: process.env.FB_APP_SECRET!,
            fb_exchange_token: this.token,
        })
        const result = await fetch(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?` + params.toString())
            .then(x => x.json());
        this.accessToken = {
            token: result.access_token,
            expires_at: new Date(+new Date() + result.expires_in * 1000)
        };
        return result.access_token;
    }

    private async register() {
        const token = await this.getAcccessToken();
        await fetch(this.baseApi + '/register', {
            method: 'POST',
            headers: {
                ['Content-Type']: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                pin: 678126
            })
        }).then(x => x.text()).then(console.log)
    }

    private async fetch<T extends {
        to: string,
    }>(data: T): Promise<{
        "messaging_product": "whatsapp",
        "contacts": [{ "input": string, "wa_id": string }],
        "messages": [{ "id": string }]
    }> {
        const token = await this.getAcccessToken();

        let x = await fetch(this.baseApi + '/messages', {
            method: 'POST',
            headers: {
                ['Content-Type']: 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                ...data
            }),
        });
        if (x.ok) return x.json();
        throw new Error(`WhatsApp error: ${x.status}\n` + await x.text());
    }

    async send(to: string, message: Message | string, options: MessageOptions = {}) {
        if (typeof message === "string")
            message = {type: 'text', text: message};
        const baseOptions = {
            to,
            type: message.type,
            context: options.replyTo ? {
                message_id: options.replyTo, // shows the message as a reply to the original user message
            } : undefined,
        }
        if (options.spoiler && message.type == "text"){
            await this.fetch({
                ...baseOptions,
                type: 'interactive',
                interactive: {
                    "type": "list",
                    "body": {
                        "text": message.text
                    },
                    "action": {
                        "sections": [
                            {
                                "title": message.text,
                                "rows": [
                                    {
                                        "id": "0",
                                        "title": options.spoiler,
                                        "description": "<ROW_DESCRIPTION_TEXT>"
                                    }
                                ]
                            }
                        ],
                        "button": "Show details",
                    }
                }
            });
            return;
        }
        switch (message.type) {
            case "text":
                await this.fetch({
                    ...baseOptions,
                    type: 'text',
                    text: {
                        body: message.text,
                        preview_url: options.preview_url
                    },
                });
                break;
            case "image": {
                const id = await this.uploadFile(message.image, `image/png`);
                await this.fetch({
                    ...baseOptions,
                    image: {
                        id
                    },
                })
                break;
            }
            case "audio": {
                const id = await this.uploadFile(message.audio, `audio/${message.audioType}`);
                await this.fetch({
                    ...baseOptions,
                    audio: {
                        id
                    },
                })
                break;
            }
        }
    }

    async uploadFile(file: Buffer, mimeType: string) {
        const token = await this.getAcccessToken();
        const data = new FormData();
        data.append('file', new File([file], `temp`, {
            type: mimeType
        }))
        data.append('messaging_product', 'whatsapp')
        data.append('type', mimeType)
        let x = await fetch(this.baseApi + '/media', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: data,
        });
        if (!x.ok)
            throw new Error(`WhatsApp error: ${x.status}\n` + await x.text());
        const {id} = await x.json();
        return id;
    }

    async handle(request: {
        body: any;
        query: any
    }) {
        const entries = request.body.entry;
        for (let entry of entries) {
            for (let change of entry.changes) {
                switch (change.field) {
                    case 'messages':
                        for (let status of change.value.statuses ?? []) {
                            console.log(status.pricing)
                        }
                        for (let message of change.value.messages ?? []) {
                            // console.log(change.value.contacts[0].profile)
                            this.emit('message', new WhatsAppMessageEvent(message, change.value.contacts[0], this));
                        }
                        break;
                }
            }
        }
    }
}

export class WhatsAppChatEvent implements ChatEvent {
    id: string | number = this.message.id;
    chat: string = this.message.from;
    timestamp = +this.message.timestamp;
    user = {
        id: this.contact.wa_id,
        name: this.contact.profile.name,
    };

    constructor(protected message: any,
                protected contact: {
                    profile: {
                        name: string
                    },
                    wa_id: string
                },
                protected messenger: WhatsAppMessenger) {
    }

    reply(message: string | Message, options?: MessageOptions | undefined): Promise<void> {
        return this.messenger.send(this.chat, message, options);
    }
}

export class WhatsAppMessageEvent extends WhatsAppChatEvent implements IncomingMessageEvent {

    async audio(): Promise<AudioMessage | undefined> {
        if (!this.message.audio) return undefined;
        throw new Error("Method not implemented.");
    }

    async text(): Promise<TextMessage | undefined> {
        if (!this.message.text) return undefined;
        return {
            type: 'text',
            text: this.message.text.body
        }
    }

}
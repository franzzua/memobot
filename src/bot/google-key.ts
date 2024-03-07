import {JWT} from "google-auth-library";

const privateKeyEnv = process.env.GOOGLE_SHEET_PRIVATE_KEY!;
let privateKey = ''
privateKey = '-----BEGIN PRIVATE KEY-----\n';
for (let i = 0; i < privateKeyEnv.length; i+=64){
    privateKey += privateKeyEnv.substring(i, i + 64)+'\n';
}
privateKey += '-----END PRIVATE KEY-----\n';

export const googleKey = new JWT({
    email: process.env.GOOGLE_SHEET_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

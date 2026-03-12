import fs from 'fs';
import dotenv from 'dotenv';
const content = fs.readFileSync('.env', 'utf8');
const env = dotenv.parse(content);
for (const key in env) {
    if (key.includes('KEY')) {
        const payload = env[key].split('.')[1];
        if (payload) {
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
            console.log(`${key} role: ${decoded.role}`);
        } else {
            console.log(`${key}: no payload`);
        }
    }
}

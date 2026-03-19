import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootEnv = path.resolve(__dirname, '../../.env');
const localEnv = path.resolve(__dirname, '../.env');

if (!process.env.VERCEL) {
    if (fs.existsSync(rootEnv)) {
        dotenv.config({ path: rootEnv, override: true });
    } else if (fs.existsSync(localEnv)) {
        dotenv.config({ path: localEnv, override: true });
    } else {
        dotenv.config({ override: true });
    }
}

import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { validateProductionConfig } from './config.js';
validateProductionConfig();
const port = Number(process.env.PORT || 3000);
const db = await openDatabase();
const app = createApp(db, { origins: (process.env.ALLOWED_ORIGINS || `http://localhost:${port},http://127.0.0.1:5173,http://localhost:5173`).split(',').map(s => s.trim()) });
app.listen(port, () => console.log(`Asgard Party: http://localhost:${port}`));

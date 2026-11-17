import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAzureClient, getAzureConfig } from './src/azure.js';
import { createApp } from './src/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = getAzureConfig(process.env);
const app = createApp({
  publicDir: path.join(__dirname, 'public'),
  azure: createAzureClient(config),
  azureConfigured: config.configured,
  middleware: [helmet({ contentSecurityPolicy: false }), express.json({ limit: '12mb' })]
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`IPA Coach listening on http://localhost:${port}`));

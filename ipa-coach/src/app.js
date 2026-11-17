import express from 'express';
import path from 'node:path';
import { decodeAudio } from './azure.js';

const TEXT_PATTERN = /^[A-Za-z][A-Za-z '\-]{0,79}$/;

export function createApp({ publicDir, azure, azureConfigured, middleware = [] }) {
  const app = express();
  middleware.forEach(item => app.use(item));
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/status', (_req, res) => res.json({ azureConfigured }));
  app.post('/api/assess', async (req, res) => {
    if (!azureConfigured) return res.status(503).json({ code: 'AZURE_NOT_CONFIGURED', message: 'Azure Speech Pronunciation Assessment is not configured.' });
    const referenceText = req.body?.referenceText?.trim();
    if (!TEXT_PATTERN.test(referenceText || '')) return res.status(400).json({ code: 'INVALID_TEXT', message: 'Choose a valid lesson prompt.' });
    try {
      const audio = decodeAudio(req.body?.audio);
      res.json(await azure.assess({ referenceText, audio }));
    } catch (error) {
      const badAudio = error.message.startsWith('Audio');
      res.status(badAudio ? 400 : 502).json({ code: badAudio ? 'INVALID_AUDIO' : 'AZURE_ERROR', message: error.message });
    }
  });

  app.use(express.static(publicDir, { extensions: ['html'] }));
  app.get('*splat', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  return app;
}

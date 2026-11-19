import test from 'node:test';
import assert from 'node:assert/strict';
import { createAzureClient, decodeAudio, getAzureConfig } from '../src/azure.js';

test('requires both Azure credentials', () => {
  assert.equal(getAzureConfig({ AZURE_SPEECH_KEY:'key' }).configured, false);
  assert.equal(getAzureConfig({ AZURE_SPEECH_KEY:'key', AZURE_SPEECH_REGION:'japaneast' }).configured, true);
});

test('accepts WAV data and rejects other formats', () => {
  assert.deepEqual(decodeAudio('data:audio/wav;base64,UklGRg=='), Buffer.from('RIFF'));
  assert.throws(() => decodeAudio('data:audio/webm;base64,AAAA'), /WAV/);
});

test('returns only real Azure assessment payload fields', async () => {
  const fetchMock = async (_url, options) => ({ ok:true, json:async()=>({NBest:[{Display:'hello',PronunciationAssessment:{PronScore:91,AccuracyScore:92,FluencyScore:88,CompletenessScore:100},Words:[]}]}), options });
  const result = await createAzureClient({configured:true,key:'secret',region:'test'}, fetchMock).assess({referenceText:'hello',audio:Buffer.from('RIFF')});
  assert.equal(result.source,'azure-pronunciation-assessment');
  assert.equal(result.pronunciationScore,91);
});

test('maps the current REST response shape with scores directly on NBest', async () => {
  const fetchMock = async () => ({
    ok: true,
    json: async () => ({
      RecognitionStatus: 'Success',
      NBest: [{
        Display: 'hello',
        PronScore: 93,
        AccuracyScore: 94,
        FluencyScore: 90,
        CompletenessScore: 100,
        Words: [{ Word: 'hello', AccuracyScore: 94, ErrorType: 'None' }]
      }]
    })
  });
  const result = await createAzureClient(
    { configured: true, key: 'secret', region: 'japaneast' },
    fetchMock
  ).assess({ referenceText: 'hello', audio: Buffer.from('RIFF') });
  assert.equal(result.pronunciationScore, 93);
  assert.equal(result.words[0].accuracyScore, 94);
  assert.equal(result.words[0].errorType, 'None');
});

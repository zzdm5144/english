const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export function getAzureConfig(env) {
  const key = env.AZURE_SPEECH_KEY?.trim();
  const region = env.AZURE_SPEECH_REGION?.trim();
  return { key, region, configured: Boolean(key && region) };
}

export function decodeAudio(dataUrl) {
  const match = /^data:audio\/(?:wav|wave|x-wav);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Audio must be a base64-encoded WAV recording.');
  const audio = Buffer.from(match[1], 'base64');
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error('Audio is empty or exceeds 8 MB.');
  return audio;
}

function assessmentHeader(referenceText) {
  return Buffer.from(JSON.stringify({
    ReferenceText: referenceText,
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: true
  })).toString('base64');
}

export function createAzureClient(config, fetchImpl = globalThis.fetch) {
  return {
    configured: config.configured,
    async assess({ referenceText, audio }) {
      if (!config.configured) throw new Error('Azure Speech is not configured.');
      const url = `https://${encodeURIComponent(config.region)}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.key,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          'Pronunciation-Assessment': assessmentHeader(referenceText),
          Accept: 'application/json'
        },
        body: audio,
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error(`Azure Speech returned ${response.status}.`);
      const body = await response.json();
      const best = body.NBest?.[0];
      // The short-audio REST API returns scores directly on an NBest entry.
      // SDK-shaped responses wrap the same values in PronunciationAssessment.
      const pronunciation = best?.PronunciationAssessment || best;
      if (!pronunciation || typeof pronunciation.PronScore !== 'number') {
        const status = body.RecognitionStatus || 'Unknown';
        throw new Error(`Azure Speech did not return pronunciation assessment scores (recognition status: ${status}).`);
      }
      return {
        source: 'azure-pronunciation-assessment',
        recognizedText: best.Display || body.DisplayText || '',
        pronunciationScore: pronunciation.PronScore,
        accuracyScore: pronunciation.AccuracyScore,
        fluencyScore: pronunciation.FluencyScore,
        completenessScore: pronunciation.CompletenessScore,
        words: (best.Words || []).map(word => {
          const wordAssessment = word.PronunciationAssessment || word;
          return {
            word: word.Word,
            accuracyScore: wordAssessment.AccuracyScore,
            errorType: wordAssessment.ErrorType,
            phonemes: (word.Phonemes || []).map(p => ({
              phoneme: p.Phoneme,
              accuracyScore: (p.PronunciationAssessment || p).AccuracyScore
            }))
          };
        })
      };
    }
  };
}

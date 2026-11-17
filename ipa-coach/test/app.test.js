import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

async function withServer(app, callback){const server=app.listen(0);await once(server,'listening');try{return await callback(`http://127.0.0.1:${server.address().port}`)}finally{server.close()}}

test('reports unconfigured Azure and never returns a score', async()=>{
  const app=createApp({publicDir:new URL('../public',import.meta.url).pathname,azure:{},azureConfigured:false});
  await withServer(app,async base=>{
    assert.deepEqual(await (await fetch(`${base}/api/status`)).json(),{azureConfigured:false});
    const response=await fetch(`${base}/api/assess`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referenceText:'hello',audio:'data:audio/wav;base64,UklGRg=='})});
    assert.equal(response.status,503);const body=await response.json();assert.equal(body.code,'AZURE_NOT_CONFIGURED');assert.equal(body.pronunciationScore,undefined);
  });
});

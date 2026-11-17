const curriculum = [
  { id:'p-i', level:0, ipa:'/iː/', text:'ee', hint:'嘴角向两侧拉，舌位高，保持长音。' },
  { id:'p-ih', level:0, ipa:'/ɪ/', text:'i', hint:'比 /iː/ 更短、更放松。' },
  { id:'p-th', level:0, ipa:'/θ/', text:'th', hint:'舌尖轻触上齿，送气但声带不振动。' },
  { id:'m-ship', level:1, ipa:'/ʃɪp/ · /ʃiːp/', text:'ship · sheep', scoreText:'ship', hint:'注意短元音 /ɪ/ 与长元音 /iː/。' },
  { id:'m-live', level:1, ipa:'/lɪv/ · /liːv/', text:'live · leave', scoreText:'leave', hint:'先听长度差异，再完整说出目标词。' },
  { id:'m-think', level:1, ipa:'/θɪŋk/ · /sɪŋk/', text:'think · sink', scoreText:'think', hint:'对比舌尖送气的 /θ/ 与 /s/。' },
  { id:'w-world', level:2, ipa:'/wɝːld/', text:'world', hint:'圆唇起音，卷舌元音后快速接 /ld/。' },
  { id:'w-comfortable', level:2, ipa:'/ˈkʌm.fɚ.t̬ə.bəl/', text:'comfortable', hint:'重音在第一音节，中间音节自然弱化。' },
  { id:'w-opportunity', level:2, ipa:'/ˌɑː.pɚˈtuː.nə.t̬i/', text:'opportunity', hint:'主重音落在 /tuː/。' }
];
const levels = ['单音素','最小对立词','完整单词'];
const state = JSON.parse(localStorage.getItem('ipa-coach-progress') || '{"completed":[],"scores":{}}');
let currentLevel = 0, current, recorder, chunks = [], recordingUrl, audioData;
const $ = id => document.getElementById(id);

function unlocked(level){ return level === 0 || curriculum.filter(x=>x.level===level-1).every(x=>state.completed.includes(x.id)); }
function save(){ localStorage.setItem('ipa-coach-progress', JSON.stringify(state)); render(); }
function render(){
  $('levels').innerHTML = levels.map((name,i)=>`<button data-level="${i}" class="${i===currentLevel?'active':''}" ${unlocked(i)?'':'disabled'}>${unlocked(i)?'':'🔒 '}${name}</button>`).join('');
  $('levels').querySelectorAll('button').forEach(button=>button.onclick=()=>{currentLevel=Number(button.dataset.level);render()});
  $('lessons').innerHTML=curriculum.filter(x=>x.level===currentLevel).map(x=>`<button class="lesson ${state.completed.includes(x.id)?'done':''}" data-id="${x.id}"><span class="badge">${state.completed.includes(x.id)?`✓ ${state.scores[x.id]??'完成'}`:'开始练习'}</span><span class="ipa">${x.ipa}</span><h3>${x.text}</h3><p>${x.hint}</p></button>`).join('');
  $('lessons').querySelectorAll('button').forEach(button=>button.onclick=()=>openLesson(button.dataset.id));
  const pct=Math.round(state.completed.length/curriculum.length*100); $('progress-value').textContent=`${pct}%`; $('progress-ring').style.background=`conic-gradient(var(--sun) ${pct}%,#315553 0)`;
}
function openLesson(id){ current=curriculum.find(x=>x.id===id); $('practice-level').textContent=levels[current.level]; $('practice-ipa').textContent=current.ipa; $('practice-text').textContent=current.text; $('practice-hint').textContent=current.hint; $('result').innerHTML=''; $('playback').hidden=true; $('assess').disabled=true; $('practice').hidden=false; }
$('close').onclick=()=>{$('practice').hidden=true};
$('listen').onclick=()=>{ speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(current.scoreText||current.text.replace(' · ',' ')); utterance.lang='en-US'; utterance.rate=.72; speechSynthesis.speak(utterance); };

function wavData(samples, sampleRate){
  const buffer=new ArrayBuffer(44+samples.length*2), view=new DataView(buffer); const write=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*0x7fff,true)); return new Blob([view],{type:'audio/wav'});
}
async function startRecording(){
  const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const context=new AudioContext({sampleRate:16000}); const source=context.createMediaStreamSource(stream); const processor=context.createScriptProcessor(4096,1,1); chunks=[];
  processor.onaudioprocess=e=>chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); source.connect(processor); processor.connect(context.destination);
  recorder={stop:async()=>{processor.disconnect();source.disconnect();stream.getTracks().forEach(t=>t.stop());await context.close();const length=chunks.reduce((n,c)=>n+c.length,0), samples=new Float32Array(length);let offset=0;chunks.forEach(c=>{samples.set(c,offset);offset+=c.length});return wavData(samples,context.sampleRate)}};
}
$('record').onclick=async()=>{
  try{ if(!recorder){await startRecording();$('record').textContent='■ 停止录音';$('record').classList.add('recording');return} const blob=await recorder.stop();recorder=null;$('record').textContent='● 重新录音';$('record').classList.remove('recording');if(recordingUrl)URL.revokeObjectURL(recordingUrl);recordingUrl=URL.createObjectURL(blob);$('playback').src=recordingUrl;$('playback').hidden=false;audioData=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob)});$('assess').disabled=!window.azureConfigured; }
  catch(error){$('result').textContent=`无法录音：${error.message}`}
};
$('assess').onclick=async()=>{
  $('assess').disabled=true;$('result').textContent='正在由 Azure 分析发音…';
  try{const response=await fetch('api/assess',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referenceText:current.scoreText||current.text,audio:audioData})});const result=await response.json();if(!response.ok)throw new Error(result.message);if(result.source!=='azure-pronunciation-assessment')throw new Error('评分来源无效');state.scores[current.id]=Math.round(result.pronunciationScore);if(!state.completed.includes(current.id))state.completed.push(current.id);save();$('result').innerHTML=`<div class="score">${Math.round(result.pronunciationScore)}</div><p>Azure 发音总分</p><div class="score-grid"><div>准确度<br><b>${Math.round(result.accuracyScore??0)}</b></div><div>流利度<br><b>${Math.round(result.fluencyScore??0)}</b></div><div>完整度<br><b>${Math.round(result.completenessScore??0)}</b></div></div><div class="word-feedback">${result.words.map(w=>`<b>${w.word}</b> ${Math.round(w.accuracyScore??0)} ${w.errorType&&w.errorType!=='None'?`· ${w.errorType}`:''}`).join('<br>')}</div>`;}
  catch(error){$('result').textContent=`评分失败：${error.message}`}finally{$('assess').disabled=!window.azureConfigured}
};

fetch('api/status').then(r=>r.json()).then(status=>{window.azureConfigured=status.azureConfigured;$('azure-status').textContent=status.azureConfigured?'Azure 评分已就绪':'Azure 评分未配置';$('azure-status').classList.add(status.azureConfigured?'ok':'bad')}).catch(()=>{$('azure-status').textContent='评分服务不可用';$('azure-status').classList.add('bad')});
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js'); render();

(function () {
  'use strict';
  const bank = window.QUESTION_BANK;
  const meta = window.THERMO_META;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
  const formatNumber = n => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
  const shuffle = items => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels = { basic:'Базовый', medium:'Средний', high:'Повышенный' };

  let stats = loadStats();
  let practice = { id:null, state:null, feedback:null, used:new Set() };
  let exam = null;

  function blankStats() { return { attempts:0, correct:0, polls:0, topics:{}, skills:{}, mistakes:[] }; }
  function loadStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem('thermo-formulas-v1'));
      if (parsed && Number.isInteger(parsed.attempts) && parsed.topics && parsed.skills) return parsed;
    } catch (_) { /* Сайт работает и там, где браузер не разрешает localStorage. */ }
    return blankStats();
  }
  function saveStats() { try { localStorage.setItem('thermo-formulas-v1', JSON.stringify(stats)); } catch (_) {} }
  function recordAttempt(q, isCorrect) {
    stats.attempts += 1;
    if (isCorrect) stats.correct += 1;
    for (const [bucket, key] of [[stats.topics,q.section],[stats.skills,q.skill]]) {
      if (!bucket[key]) bucket[key] = { attempts:0, correct:0 };
      bucket[key].attempts += 1;
      if (isCorrect) bucket[key].correct += 1;
    }
    if (!isCorrect) stats.mistakes = [{ id:q.id, section:q.section, skill:q.skill }, ...stats.mistakes].slice(0,12);
    saveStats();
  }

  function activateView(id) {
    $$('.view').forEach(el => { const active = el.id === id; el.hidden = !active; el.classList.toggle('active',active); });
    $$('.nav-button').forEach(el => {
      const active = el.dataset.view === id;
      el.classList.toggle('active',active);
      if (active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    if (id === 'stats') renderStats();
    if (id === 'practice' && !practice.id) nextPractice();
    window.scrollTo({ top:0, behavior:'instant' });
  }
  $$('.nav-button').forEach(button => button.addEventListener('click',() => activateView(button.dataset.view)));

  const formulas = [
    { key:'Q', expression:'Q = cm(t₂ − t₁)', short:'Q = cmΔt', explain:'Умножь удельную теплоёмкость на массу и изменение температуры.', options:['Q = cm(t₂ − t₁)','Q = cm/(t₂ − t₁)','Q = (t₂ − t₁)/(cm)'] },
    { key:'c', expression:'c = Q/[m(t₂ − t₁)]', short:'c = Q/(mΔt)', explain:'Раздели обе части Q = cmΔt на mΔt.', options:['c = Qm/Δt','c = Q/(mΔt)','c = mΔt/Q'] },
    { key:'m', expression:'m = Q/[c(t₂ − t₁)]', short:'m = Q/(cΔt)', explain:'Раздели обе части Q = cmΔt на cΔt.', options:['m = Qc/Δt','m = cΔt/Q','m = Q/(cΔt)'] },
    { key:'Δt', expression:'Δt = Q/(cm)', short:'Δt = Q/(cm)', explain:'Раздели обе части Q = cmΔt на cm. При этом Δt = t₂ − t₁.', options:['Δt = cm/Q','Δt = Q/(cm)','Δt = Qcm'] },
    { key:'t₁', expression:'t₁ = t₂ − Q/(cm)', short:'t₁ = t₂ − Q/(cm)', explain:'Из t₂ − t₁ = Q/(cm) вырази начальную температуру.', options:['t₁ = t₂ + Q/(cm)','t₁ = Q/(cm) − t₂','t₁ = t₂ − Q/(cm)'] },
    { key:'t₂', expression:'t₂ = t₁ + Q/(cm)', short:'t₂ = t₁ + Q/(cm)', explain:'Прибавь Δt = Q/(cm) к начальной температуре.', options:['t₂ = t₁ + Q/(cm)','t₂ = t₁ − Q/(cm)','t₂ = Q/(cm) − t₁'] }
  ];
  let studyTarget = 0;
  function renderStudy() {
    $('#formula-targets').innerHTML = formulas.map((f,i) => `<button type="button" class="target-chip ${i===studyTarget?'active':''}" data-i="${i}" aria-pressed="${i===studyTarget}">${f.key}</button>`).join('');
    const f = formulas[studyTarget];
    $('#derivation').innerHTML = `<div class="equation">${f.expression}</div><p>${f.explain}</p>`;
    $$('#formula-targets button').forEach(button => button.addEventListener('click',() => { studyTarget = +button.dataset.i; renderStudy(); }));
  }
  renderStudy();

  let model = 'experiment';
  $$('.subnav-button').forEach(button => button.addEventListener('click',() => {
    model = button.dataset.model;
    $$('.subnav-button').forEach(el => { const active = el===button; el.classList.toggle('active',active); el.setAttribute('aria-selected',String(active)); });
    $$('.model-panel').forEach(el => { el.hidden = el.id !== `model-${model}`; el.classList.toggle('active',!el.hidden); });
  }));

  function updateHeat() {
    const c = +$('#heat-c').value, m = +$('#heat-m').value, t1 = +$('#heat-t1').value, t2 = +$('#heat-t2').value;
    const delta = t2-t1, q = c*m*delta;
    for (const [name,value] of [['c',c],['m',m],['t1',t1],['t2',t2]]) $(`#heat-${name}-value`).textContent = formatNumber(value);
    $('#bar-t1').style.width = t1+'%'; $('#bar-t2').style.width = t2+'%';
    $('#bar-t2').classList.toggle('cooling',delta<0);
    $('#temp-label-t1').textContent = `${t1} °C`; $('#temp-label-t2').textContent = `${t2} °C`;
    $('#heat-substitution').textContent = `Q = ${formatNumber(c)} · ${formatNumber(m)} · (${t2} − ${t1})`;
    $('#heat-output').textContent = `${formatNumber(q)} Дж`;
    $('.heat-result').className = 'heat-result' + (delta<0?' cooling':delta===0?' steady':'');
    $('#heat-explanation').textContent = delta>0
      ? `Δt = +${delta} °C: тело нагревается, Q положительно.`
      : delta<0 ? `Δt = ${delta} °C: тело остывает, Q отрицательно. Отдано по модулю ${formatNumber(Math.abs(q))} Дж.`
        : 'Δt = 0 °C: температура не меняется, по этой формуле Q = 0.';
  }
  $$('input[type="range"]', $('#model-experiment')).forEach(input => input.addEventListener('input',updateHeat));
  $('#swap-temperatures').addEventListener('click',() => {
    const first = $('#heat-t1').value;
    $('#heat-t1').value = $('#heat-t2').value; $('#heat-t2').value = first; updateHeat();
  });
  updateHeat();

  let builderTarget = 0;
  function renderTargetChips(host, selected, callback) {
    host.innerHTML = formulas.map((f,i) => `<button type="button" class="target-chip ${i===selected?'active':''}" aria-pressed="${i===selected}" data-index="${i}">${f.key}</button>`).join('');
    $$('button',host).forEach(button => button.addEventListener('click',() => callback(+button.dataset.index)));
  }
  function feedback(host, good, message, answer) {
    host.innerHTML = `<div class="feedback-box ${good?'good':'bad'}"><strong>${good?'Верно!':'Пока нет.'}</strong><p>${answer?`Правильный ответ: ${answer}. `:''}${message}</p></div>`;
  }
  function renderBuilder() {
    const f = formulas[builderTarget];
    renderTargetChips($('#builder-targets'),builderTarget,i => { builderTarget=i; renderBuilder(); });
    $('#builder-prompt').textContent = `Вырази ${f.key} из Q = cm(t₂ − t₁)`;
    $('#builder-feedback').innerHTML = '';
    $('#builder-options').innerHTML = f.options.map((option,i) => `<button type="button" class="answer-button" data-option="${i}">${option}</button>`).join('');
    $$('#builder-options button').forEach(button => button.addEventListener('click',() => {
      const good = button.textContent === f.expression || button.textContent === f.short;
      $$('#builder-options button').forEach(el => { el.disabled=true; if(el.textContent===f.expression || el.textContent===f.short) el.classList.add('correct'); });
      if(!good) button.classList.add('incorrect');
      feedback($('#builder-feedback'),good,f.explain,good?'':f.expression);
    }));
  }
  renderBuilder();

  const units = [
    { expression:'[c] · [m] · [Δt] = Дж/(кг·°C) · кг · °C', result:'Дж', why:'кг и °C сокращаются; остаются Дж.' },
    { expression:'[Q] / ([m] · [Δt]) = Дж/(кг·°C)', result:'Дж/(кг·°C)', why:'В знаменателе кг · °C — это единица удельной теплоёмкости.' },
    { expression:'[Q] / ([c] · [Δt]) = Дж / (Дж/(кг·°C) · °C)', result:'кг', why:'Дж и °C сокращаются; остаётся кг.' },
    { expression:'[Q] / ([c] · [m]) = Дж / (Дж/(кг·°C) · кг)', result:'°C', why:'Дж и кг сокращаются; остаются градусы Цельсия.' }
  ];
  let unitTarget = 0;
  function renderUnits() {
    const host = $('#unit-targets');
    host.innerHTML = formulas.slice(0,4).map((f,i) => `<button type="button" class="target-chip ${i===unitTarget?'active':''}" aria-pressed="${i===unitTarget}" data-index="${i}">${f.key}</button>`).join('');
    $$('button',host).forEach(button => button.addEventListener('click',() => { unitTarget = +button.dataset.index; renderUnits(); }));
    const item = units[unitTarget];
    $('#unit-expression').textContent = item.expression + ' = ?';
    $('#unit-feedback').innerHTML = '';
    $('#unit-options').innerHTML = ['Дж','Дж/(кг·°C)','кг','°C'].map((answer,i) => `<button type="button" class="answer-button" data-option="${i}">${answer}</button>`).join('');
    $$('#unit-options button').forEach(button => button.addEventListener('click',() => {
      const good = button.textContent === item.result;
      $$('#unit-options button').forEach(el => { el.disabled=true; if(el.textContent===item.result) el.classList.add('correct'); });
      if(!good) button.classList.add('incorrect');
      feedback($('#unit-feedback'),good,item.why,good?'':item.result);
    }));
  }
  renderUnits();

  const mistakes = [
    { name:'Разность', prompt:'Тело нагрелось с 20 °C до 35 °C.', lines:['t₁ = 20 °C, t₂ = 35 °C','Δt = t₁ − t₂ = −15 °C','Конечная температура выше начальной на 15 °C'], wrong:1, why:'Δt = t₂ − t₁ = 35 − 20 = +15 °C.' },
    { name:'Масса', prompt:'Вырази массу из Q = cmΔt.', lines:['Q = cmΔt','Q/c = mΔt','m = Q·Δt/c'], wrong:2, why:'Нужно разделить ещё на Δt: m = Q/(cΔt).' },
    { name:'Охлаждение', prompt:'c = 200 Дж/(кг·°C), m = 2 кг, t₁ = 30 °C, t₂ = 20 °C.', lines:['Δt = 20 − 30 = −10 °C','Q = 200 · 2 · (−10) = −4000 Дж','Тело отдало −4000 Дж, если считать отданную теплоту положительной величиной'], wrong:2, why:'По формуле Q = −4000 Дж; положительная величина отданного тепла равна |Q| = 4000 Дж.' }
  ];
  let mistakeTarget = 0;
  function renderMistake() {
    $('#mistake-targets').innerHTML = mistakes.map((item,i) => `<button type="button" class="subnav-button ${i===mistakeTarget?'active':''}" data-index="${i}">${item.name}</button>`).join('');
    $$('#mistake-targets button').forEach(button => button.addEventListener('click',() => { mistakeTarget = +button.dataset.index; renderMistake(); }));
    const item = mistakes[mistakeTarget];
    $('#mistake-prompt').textContent = item.prompt;
    $('#mistake-feedback').innerHTML = '';
    $('#mistake-options').innerHTML = item.lines.map((line,i) => `<button type="button" class="answer-button" data-index="${i}">${i+1}. ${line}</button>`).join('');
    $$('#mistake-options button').forEach(button => button.addEventListener('click',() => {
      const good = +button.dataset.index === item.wrong;
      $$('#mistake-options button').forEach(el => { el.disabled=true; if(+el.dataset.index===item.wrong) el.classList.add('incorrect'); });
      if(!good) button.classList.add('selected');
      feedback($('#mistake-feedback'),good,item.why,good?'':`строка ${item.wrong+1}`);
    }));
  }
  renderMistake();

  for (const [key,title] of Object.entries(meta.sections)) $('#practice-section').insertAdjacentHTML('beforeend',`<option value="${key}">${title}</option>`);
  for (const [key,title] of Object.entries(meta.skills)) $('#practice-skill').insertAdjacentHTML('beforeend',`<option value="${key}">${title}</option>`);
  [$('#practice-section'),$('#practice-skill')].forEach(el => el.addEventListener('change',() => { practice = { id:null,state:null,feedback:null,used:new Set() }; nextPractice(); }));

  function filteredQuestions() {
    const section = $('#practice-section').value, skill = $('#practice-skill').value;
    return bank.filter(q => (section==='all'||q.section===section) && (skill==='all'||q.skill===skill));
  }
  function freshState(q) {
    if (q.type==='sequence') {
      let order = shuffle(q.options.map((_,i)=>i));
      if (order.every((value,i)=>value===i)) order = [...order.slice(1),order[0]];
      return { selected:order };
    }
    return { selected:q.type==='multiple'?[]:q.type==='match'?Array(q.options.length).fill(''):null };
  }
  function nextPractice() {
    const pool = filteredQuestions();
    $('#practice-count').textContent = `${pool.length} заданий по фильтру`;
    if(!pool.length) { practice.id=null; $('#practice-card').innerHTML='<p>Для этого сочетания темы и навыка заданий нет. Измени фильтр.</p>'; return; }
    let available = pool.filter(q=>!practice.used.has(q.id));
    if (!available.length) { practice.used.clear(); available=pool; }
    const q = available[Math.floor(Math.random()*available.length)];
    practice.used.add(q.id); practice.id=q.id; practice.state=freshState(q); practice.feedback=null;
    renderPractice();
  }
  function answerComplete(q,state) {
    if (q.type==='oral'||q.type==='sequence') return true;
    if (q.type==='multiple') return state.selected.length>0;
    if (q.type==='match') return state.selected.every(Boolean);
    return state.selected!==null;
  }
  function checkAnswer(q,state) {
    if (q.type==='single'||q.type==='truefalse') return state.selected===q.correctAnswer;
    if (q.type==='multiple') return JSON.stringify([...state.selected].sort())===JSON.stringify([...q.correctAnswer].sort());
    if (q.type==='match') return state.selected.every((answer,i)=>answer===q.options[i][1]);
    if (q.type==='sequence') return state.selected.every((value,i)=>value===i);
    return false;
  }
  function correctText(q) {
    if(q.type==='single'||q.type==='truefalse') return q.options[q.correctAnswer];
    if(q.type==='multiple') return q.correctAnswer.map(i=>q.options[i]).join('; ');
    if(q.type==='match') return q.options.map(([left,right])=>`${left} → ${right}`).join('; ');
    if(q.type==='sequence') return q.options.join(' → ');
    return q.explanation;
  }
  function questionMarkup(q,state,locked) {
    if (q.type==='oral') return '<div class="oral-intro">Ответь вслух. Длинный текст набирать не нужно.</div>';
    if(q.type==='single'||q.type==='truefalse'||q.type==='multiple') {
      return `<div class="options-list">${q.options.map((option,i)=>{
        const selected=q.type==='multiple'?state.selected.includes(i):state.selected===i;
        return `<button type="button" class="${q.type==='multiple'?'check-option':'option-button'} ${selected?'selected':''}" data-option="${i}" aria-pressed="${selected}" ${locked?'disabled':''}>${q.type==='multiple'?`<span class="mark" aria-hidden="true">${selected?'✓':''}</span>`:''}<span>${escapeHTML(option)}</span></button>`;
      }).join('')}</div>`;
    }
    if(q.type==='match') {
      const rights=shuffle(q.options.map(pair=>pair[1]));
      // Порядок хранится в состоянии, чтобы выбор не перескакивал при перемещении по странице.
      if(!state.rights) state.rights=rights;
      return `<div class="match-list">${q.options.map(([left],i)=>`<label class="match-row"><span>${escapeHTML(left)}</span><select data-pair="${i}" ${locked?'disabled':''}><option value="">Выбери соответствие</option>${state.rights.map(right=>`<option value="${escapeHTML(right)}" ${state.selected[i]===right?'selected':''}>${escapeHTML(right)}</option>`).join('')}</select></label>`).join('')}</div>`;
    }
    if(q.type==='sequence') return `<ol class="sequence-list">${state.selected.map((original,i)=>`<li class="sequence-item"><span>${i+1}. ${escapeHTML(q.options[original])}</span><span class="sequence-controls"><button type="button" aria-label="Поднять строку ${i+1}" data-move="${i},-1" ${locked||i===0?'disabled':''}>↑</button><button type="button" aria-label="Опустить строку ${i+1}" data-move="${i},1" ${locked||i===state.selected.length-1?'disabled':''}>↓</button></span></li>`).join('')}</ol>`;
    return '';
  }
  function attachAnswerEvents(host,q,state,rerender) {
    $$('[data-option]',host).forEach(button => button.addEventListener('click',() => {
      const i=+button.dataset.option;
      if(q.type==='multiple') state.selected=state.selected.includes(i)?state.selected.filter(x=>x!==i):[...state.selected,i];
      else state.selected=i;
      if(q.type==='multiple') {
        const selected=state.selected.includes(i);
        button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',String(selected));
        $('.mark',button).textContent=selected?'✓':'';
      } else $$('[data-option]',host).forEach(el=>{ const selected=+el.dataset.option===i; el.classList.toggle('selected',selected); el.setAttribute('aria-pressed',String(selected)); });
      const warning=$('.inline-warning',host); if(warning) warning.remove();
    }));
    $$('[data-pair]',host).forEach(select => select.addEventListener('change',()=>{state.selected[+select.dataset.pair]=select.value;}));
    $$('[data-move]',host).forEach(button => button.addEventListener('click',() => {
      const [i,step]=button.dataset.move.split(',').map(Number);
      [state.selected[i],state.selected[i+step]]=[state.selected[i+step],state.selected[i]];
      rerender();
    }));
  }
  function questionHeader(q,number) {
    return `<div class="question-meta"><span class="meta-pill">${number||meta.sections[q.section]}</span><span class="meta-pill">${meta.skills[q.skill]}</span><span class="meta-pill">${labels[q.difficulty]}</span></div><h3>${escapeHTML(q.prompt)}</h3>`;
  }
  function oralSample(q) {
    return `<div class="oral-sample"><strong>Пример хорошего ответа</strong><p>${escapeHTML(q.explanation)}</p><strong>Что должно прозвучать</strong><ul>${q.points.map(p=>`<li>${escapeHTML(p)}</li>`).join('')}</ul><small>Дополнительно: ${escapeHTML(q.bonus)}</small></div>`;
  }
  function renderPractice() {
    const q=bank.find(item=>item.id===practice.id), state=practice.state, result=practice.feedback;
    if(!q) return;
    const host=$('#practice-card');
    let bottom='';
    if(q.type==='oral') {
      bottom=result===null
        ? '<div class="question-actions"><button type="button" class="primary-button" id="show-oral">Показать пример ответа</button></div>'
        : oralSample(q)+(typeof result==='boolean'?`<div class="answer-feedback"><div class="feedback-box ${result?'good':'bad'}">${result?'Отлично, переходи дальше.':'Повтори ответ вслух ещё раз после занятия.'}</div></div><button type="button" class="primary-button" id="next-question">Следующий вопрос</button>`:'<div class="question-actions"><button type="button" class="primary-button" id="oral-yes">Всё прозвучало</button><button type="button" class="secondary-button" id="oral-no">Нужно повторить</button></div>');
    } else if(result!==null) {
      bottom=`<div class="answer-feedback"><div class="feedback-box ${result?'good':'bad'}"><strong>${result?'Верно!':'Неверно.'}</strong><p>${result?'':`Правильный ответ: ${escapeHTML(correctText(q))}. `}${escapeHTML(q.explanation)}</p></div></div><button type="button" class="primary-button" id="next-question">Следующий вопрос</button>`;
    } else bottom='<div class="question-actions"><button type="button" class="primary-button" id="check-practice">Проверить ответ</button></div>';
    host.innerHTML=questionHeader(q)+questionMarkup(q,state,result!==null)+bottom;
    if(result===null && q.type!=='oral') attachAnswerEvents(host,q,state,renderPractice);
    $('#check-practice',host)?.addEventListener('click',() => {
      if(!answerComplete(q,state)) { $('.question-actions',host).insertAdjacentHTML('beforeend','<p class="inline-warning">Сначала выбери ответ.</p>'); return; }
      const correct=checkAnswer(q,state); recordAttempt(q,correct); practice.feedback=correct; renderPractice();
    });
    $('#show-oral',host)?.addEventListener('click',()=>{ practice.feedback='revealed'; renderPractice(); });
    $('#oral-yes',host)?.addEventListener('click',()=>{ recordAttempt(q,true); practice.feedback=true; renderPractice(); });
    $('#oral-no',host)?.addEventListener('click',()=>{ recordAttempt(q,false); practice.feedback=false; renderPractice(); });
    $('#next-question',host)?.addEventListener('click',nextPractice);
  }

  function selectExam() {
    const oral=shuffle(bank.filter(q=>q.type==='oral'))[0];
    const picked=[], usedTypes=new Set(), usedSkills=new Set(), usedLevels=new Set();
    const sectionOrder=shuffle(Object.keys(meta.sections));
    for(let round=0;round<3;round++) for(const section of sectionOrder) {
      if(round===2 && section===oral.section) continue;
      const candidates=bank.filter(q=>q.section===section && q.type!=='oral' && !picked.includes(q));
      const scored=candidates.map(q=>({q,score:
        (usedTypes.has(q.type)?0:5)+(usedSkills.has(q.skill)?0:3)+(usedLevels.has(q.difficulty)?0:2)
        -(q.type==='single'?1:0)+Math.random()*2 }));
      scored.sort((a,b)=>b.score-a.score);
      const chosen=scored[0].q;
      picked.push(chosen); usedTypes.add(chosen.type); usedSkills.add(chosen.skill); usedLevels.add(chosen.difficulty);
    }
    return [...shuffle(picked),oral];
  }
  function renderExam() {
    const host=$('#exam-area');
    if(!exam) { host.innerHTML='<div class="exam-intro"><h3>Готов к проверке?</h3><p>Вопросы берутся из всех четырёх тем. Во время опроса ответы не показываются; после 11 заданий ты проверишь свой устный ответ и увидишь общий результат.</p><button type="button" class="primary-button" id="start-exam">Начать опрос</button></div>'; $('#start-exam').addEventListener('click',()=>{ exam={questions:selectExam(),index:0,responses:[],state:null,phase:'questions'}; exam.state=freshState(exam.questions[0]); renderExam(); }); return; }
    if(exam.phase==='review') { renderOralReview(); return; }
    if(exam.phase==='results') { renderExamResults(); return; }
    const q=exam.questions[exam.index], state=exam.state;
    const number=`Задание ${exam.index+1} из ${exam.questions.length}`;
    host.innerHTML=`<div class="exam-progress"><span>${number}</span><div class="progress-track"><div style="width:${100*exam.index/exam.questions.length}%"></div></div></div><div class="question-card">${questionHeader(q,null)}${questionMarkup(q,state,false)}<div class="question-actions"><button type="button" class="primary-button" id="next-exam">${q.type==='oral'?'Я ответил(а) вслух':exam.index===exam.questions.length-1?'Завершить вопросы':'Следующее задание'}</button></div></div>`;
    const card=$('.question-card',host);
    if(q.type!=='oral') attachAnswerEvents(card,q,state,renderExam);
    $('#next-exam').addEventListener('click',() => {
      if(!answerComplete(q,state)) { $('.question-actions',card).insertAdjacentHTML('beforeend','<p class="inline-warning">Сначала выбери ответ.</p>'); return; }
      exam.responses.push({q,state:JSON.parse(JSON.stringify(state))});
      exam.index++;
      if(exam.index>=exam.questions.length) exam.phase='review';
      else exam.state=freshState(exam.questions[exam.index]);
      renderExam();
    });
  }
  function renderOralReview() {
    const q=exam.questions.find(item=>item.type==='oral');
    $('#exam-area').innerHTML=`<div class="question-card exam-review"><div class="question-meta"><span class="meta-pill">Самопроверка устного ответа</span></div><h3>${escapeHTML(q.prompt)}</h3>${oralSample(q)}<p>Отметь, что ты действительно сказал(а). Это последний шаг перед результатом.</p>${q.points.map((point,i)=>`<label class="review-point"><input type="checkbox" data-point="${i}">${escapeHTML(point)}</label>`).join('')}<button type="button" class="primary-button" id="finish-exam">Показать результат</button></div>`;
    $('#finish-exam').addEventListener('click',() => {
      const oralGood=$$('[data-point]:checked',$('#exam-area')).length===q.points.length;
      exam.results=exam.responses.map(({q:question,state})=>({ q:question,correct:question.type==='oral'?oralGood:checkAnswer(question,state) }));
      exam.results.forEach(item=>recordAttempt(item.q,item.correct));
      stats.polls++; saveStats(); exam.phase='results'; renderExam();
    });
  }
  function renderExamResults() {
    const count=exam.results.filter(r=>r.correct).length, total=exam.results.length, percent=Math.round(100*count/total);
    const wrong=exam.results.filter(r=>!r.correct);
    const byTopic={}, bySkill={};
    wrong.forEach(({q})=>{byTopic[q.section]=(byTopic[q.section]||0)+1;bySkill[q.skill]=(bySkill[q.skill]||0)+1;});
    const wordList=(counts,labelsMap)=>Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([key,n])=>`${labelsMap[key]} — ${n}`).join('; ');
    $('#exam-area').innerHTML=`<div class="summary-grid"><div class="summary-card"><strong>${count}/${total}</strong><span>правильно</span></div><div class="summary-card"><strong>${percent} %</strong><span>точность</span></div><div class="summary-card"><strong>${wrong.length}</strong><span>ошибок</span></div><div class="summary-card"><strong>4</strong><span>темы в опросе</span></div></div><div class="card exam-review"><h3>${wrong.length?'Что повторить':'Все задания решены верно'}</h3><p>${wrong.length?`Темы ошибок: ${escapeHTML(wordList(byTopic,meta.sections))}. Навыки: ${escapeHTML(wordList(bySkill,meta.skills))}.`:'Можно пройти опрос ещё раз: выпадут другие задания.'}</p>${wrong.length?`<div class="review-list"><h3>Разбор ошибок</h3>${wrong.map(({q})=>`<details><summary>${escapeHTML(q.prompt)}</summary><p><strong>Ответ:</strong> ${escapeHTML(correctText(q))}. ${escapeHTML(q.explanation)}</p></details>`).join('')}</div>`:''}<button type="button" class="primary-button" id="repeat-exam">Пройти ещё раз</button></div>`;
    $('#repeat-exam').addEventListener('click',()=>{exam=null;renderExam();});
  }
  renderExam();

  function breakdown(bucket,labelsMap) {
    return `<ul class="breakdown-list">${Object.entries(labelsMap).map(([key,label])=>{
      const item=bucket[key]||{attempts:0,correct:0}, percent=item.attempts?Math.round(100*item.correct/item.attempts):0;
      return `<li><div class="breakdown-top"><span>${label}</span><span>${item.attempts?`${percent} % · ${item.correct}/${item.attempts}`:'пока нет ответов'}</span></div><div class="breakdown-track"><div class="breakdown-fill" style="width:${percent}%"></div></div></li>`;
    }).join('')}</ul>`;
  }
  function renderStats() {
    const wrong=stats.attempts-stats.correct, percent=stats.attempts?Math.round(100*stats.correct/stats.attempts):0;
    const weakest=(bucket,labelsMap)=>Object.entries(bucket).filter(([,v])=>v.attempts>=2).sort((a,b)=>a[1].correct/a[1].attempts-b[1].correct/b[1].attempts)[0];
    const topic=weakest(stats.topics,meta.sections), skill=weakest(stats.skills,meta.skills);
    let repeat='Ответь на несколько вопросов, и здесь появятся темы и навыки для повторения.';
    if(topic||skill) repeat=[topic?`${meta.sections[topic[0]]}: ${Math.round(100*topic[1].correct/topic[1].attempts)} %`:null,
      skill?`${meta.skills[skill[0]]}: ${Math.round(100*skill[1].correct/skill[1].attempts)} %`:null].filter(Boolean).join(' · ');
    else if(stats.mistakes.length) repeat=`Последняя ошибка: ${meta.sections[stats.mistakes[0].section]} · ${meta.skills[stats.mistakes[0].skill]}.`;
    $('#stats-area').innerHTML=`<div class="summary-grid"><div class="summary-card"><strong>${stats.attempts}</strong><span>выполнено</span></div><div class="summary-card"><strong>${stats.correct}</strong><span>правильно</span></div><div class="summary-card"><strong>${wrong}</strong><span>ошибок</span></div><div class="summary-card"><strong>${percent} %</strong><span>точность · опросов: ${stats.polls}</span></div></div><div class="breakdown-grid"><div class="card"><div class="card-heading"><span class="card-index">А</span><h3>По темам</h3></div>${breakdown(stats.topics,meta.sections)}</div><div class="card"><div class="card-heading"><span class="card-index">Б</span><h3>По навыкам</h3></div>${breakdown(stats.skills,meta.skills)}</div></div><div class="needs-repeat"><h3>Что повторить</h3><p>${repeat}</p></div>`;
  }
  $('#reset-stats').addEventListener('click',() => {
    if(!window.confirm('Удалить всю статистику на этом устройстве?')) return;
    stats=blankStats(); saveStats(); renderStats();
  });
  renderStats();
})();

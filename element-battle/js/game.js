(() => {
  const Q = window.ElementBattleQuestions;
  const D = window.ElementBattleData;
  const FX = window.ElementBattleEffects;
  const Audio = window.ElementBattleAudio;
  const Net = window.ElementBattleNetwork;

  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const DIFFICULTY_LABEL = { easy:'簡單', medium:'中等', hard:'困難' };
  const state = {
    playMode:'local', difficulty:'easy', deviceMode:'normal',
    mode:'local', role:'local', localPlayer:null, roomCode:null,
    running:false, over:false, winner:null,
    players:{
      1:{hp:7, combo:0, animal:null, question:null, locked:true, history:[], questionCount:0},
      2:{hp:7, combo:0, animal:null, question:null, locked:true, history:[], questionCount:0}
    }
  };

  let combatQueue = new Map();
  let combatTimer = null;
  let pendingRemoteAnswer = null;
  let pendingHostMeta = null;

  function setScreen(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('is-active');
    $(id).classList.add('is-active');
  }

  function chooseAnimals() {
    const a = D.animals[Math.floor(Math.random()*D.animals.length)];
    let b = D.animals[Math.floor(Math.random()*D.animals.length)];
    while (b.emoji === a.emoji) b = D.animals[Math.floor(Math.random()*D.animals.length)];
    return {1:a, 2:b};
  }

  function resetPlayers(animals = chooseAnimals()) {
    for (const p of [1,2]) {
      Object.assign(state.players[p], {
        hp:7, combo:0, animal:animals[p], question:null, locked:true,
        history:[], questionCount:0
      });
    }
    state.running = false;
    state.over = false;
    state.winner = null;
    pendingRemoteAnswer = null;
    combatQueue = new Map();
    clearTimeout(combatTimer); combatTimer = null;
  }

  function renderAnimals() {
    for (const p of [1,2]) {
      const animal = state.players[p].animal || D.animals[p-1];
      $(`player${p}Animal`).textContent = animal.emoji;
      $(`player${p}AnimalName`).textContent = animal.name;
    }
  }

  function renderHearts(player) {
    const hp = state.players[player].hp;
    const wrap = $(`player${player}Hearts`);
    wrap.innerHTML = '';
    for (let i=0;i<7;i++) {
      const heart = document.createElement('span');
      heart.className = `heart${i < hp ? '' : ' is-empty'}`;
      heart.dataset.index = i;
      heart.textContent = i < hp ? '♥' : '♡';
      wrap.appendChild(heart);
    }
    $(`player${player}HpText`).textContent = `${hp} / 7`;
    $(`player${player}Combo`).textContent = `COMBO × ${state.players[player].combo}`;
  }

  function renderAllState() { renderHearts(1); renderHearts(2); renderAnimals(); }

  function setOnlinePanelRoles() {
    const board = $('gameBoard');
    board.classList.toggle('online', state.mode === 'online');
    board.classList.toggle('player-two-local', state.mode === 'online' && state.localPlayer === 2);
    for (const p of [1,2]) {
      const panel = $(`player${p}Panel`);
      panel.classList.remove('is-local','is-remote');
      if (state.mode === 'online') panel.classList.add(p === state.localPlayer ? 'is-local' : 'is-remote');
      $(`player${p}Waiting`).hidden = !(state.mode === 'online' && p !== state.localPlayer);
    }
    if (state.mode === 'online') {
      $(`player${state.localPlayer}Role`).textContent = '你';
      $(`player${state.localPlayer === 1 ? 2 : 1}Role`).textContent = '對手';
    } else {
      $('player1Role').textContent = '藍隊';
      $('player2Role').textContent = '紅隊';
    }
  }

  async function typesetPlayer(player) {
    if (!window.MathJax?.typesetPromise) return;
    try {
      await MathJax.typesetPromise([$(`player${player}QuestionCard`)]);
    } catch (err) { console.warn('MathJax typeset failed', err); }
  }

  function renderQuestion(player) {
    const ps = state.players[player];
    const q = ps.question;
    if (!q) return;
    const card = $(`player${player}QuestionCard`);
    if (window.MathJax?.typesetClear) {
      try { MathJax.typesetClear([card]); } catch (_) {}
    }
    $(`player${player}QuestionType`).textContent = q.type;
    $(`player${player}QuestionCount`).textContent = `Q${ps.questionCount}`;
    $(`player${player}Question`).innerHTML = q.prompt;
    $(`player${player}Feedback`).textContent = '';
    const grid = $(`player${player}Answers`);
    grid.innerHTML = '';
    const letters = ['A','B','C','D'];
    q.options.forEach((option,index) => {
      const btn = $('answerButtonTemplate').content.firstElementChild.cloneNode(true);
      btn.dataset.index = index;
      btn.querySelector('.answer-letter').textContent = letters[index];
      btn.querySelector('.answer-value').innerHTML = option;
      btn.addEventListener('click', () => answerQuestion(player, index, btn), {once:true});
      grid.appendChild(btn);
    });
    typesetPlayer(player);
  }

  function nextQuestion(player) {
    if (state.over || !state.running) return;
    if (state.mode === 'online' && player !== state.localPlayer) return;
    const ps = state.players[player];
    ps.question = Q.generateQuestion(state.difficulty, ps.history);
    ps.history.push(ps.question.key);
    if (ps.history.length > 8) ps.history.shift();
    ps.questionCount += 1;
    ps.locked = false;
    renderQuestion(player);
  }

  function lockPlayer(player) {
    state.players[player].locked = true;
    for (const btn of $(`player${player}Answers`).querySelectorAll('button')) btn.disabled = true;
  }

  async function answerQuestion(player, answerIndex, button) {
    const ps = state.players[player];
    if (!state.running || state.over || ps.locked || !ps.question) return;
    if (state.mode === 'online' && player !== state.localPlayer) return;

    await Audio.unlock();
    lockPlayer(player);
    const correct = answerIndex === ps.question.correctIndex;
    button.classList.add(correct ? 'is-correct' : 'is-wrong');
    const correctBtn = $(`player${player}Answers`).querySelector(`[data-index="${ps.question.correctIndex}"]`);
    if (!correct && correctBtn) correctBtn.classList.add('is-correct');
    $(`player${player}Feedback`).textContent = correct ? '答對！準備攻擊！' : `答錯了。${ps.question.explanation || '下一題再來！'}`;
    typesetPlayer(player);

    const eventId = uid();
    if (state.mode === 'online' && state.role === 'guest') {
      pendingRemoteAnswer = {eventId, player, correct};
      try {
        const sent = await Net.sendAnswer(correct, eventId);
        if (!sent) throw new Error('Realtime send failed');
      } catch (err) {
        console.error(err);
        pendingRemoteAnswer = null;
        ps.locked = false;
        $(`player${player}Feedback`).textContent = '傳送答案失敗，請再試一次。';
        for (const btn of $(`player${player}Answers`).querySelectorAll('button')) btn.disabled = false;
      }
      return;
    }

    queueCombat({player, correct, eventId});
  }

  function queueCombat(event) {
    if (!state.running || state.over || combatQueue.has(event.player)) return;
    combatQueue.set(event.player, event);
    clearTimeout(combatTimer);
    combatTimer = setTimeout(flushCombat, 120);
  }

  function combatAnimation(event) {
    const player = event.player;
    if (event.correct) {
      const target = player === 1 ? 2 : 1;
      Audio.success();
      Audio.laser();
      FX.petalRain(player);
      FX.laserAttack(player, target);
      setTimeout(()=>Audio.hit(), 230);
    } else {
      Audio.wrong();
      FX.impact(player);
      setTimeout(()=>Audio.hit(), 80);
    }
  }

  function snapshot(resolvedEvents = []) {
    return {
      hp1:state.players[1].hp, hp2:state.players[2].hp,
      combo1:state.players[1].combo, combo2:state.players[2].combo,
      running:state.running, over:state.over, winner:state.winner,
      animals:{1:state.players[1].animal,2:state.players[2].animal},
      resolvedEvents
    };
  }

  async function flushCombat() {
    combatTimer = null;
    if (!state.running || state.over) { combatQueue.clear(); return; }
    const events = [...combatQueue.values()];
    combatQueue.clear();
    if (!events.length) return;

    const oldHp = {1:state.players[1].hp,2:state.players[2].hp};
    const damage = {1:0,2:0};

    for (const event of events) {
      if (event.correct) {
        state.players[event.player].combo += 1;
        damage[event.player === 1 ? 2 : 1] += 1;
      } else {
        state.players[event.player].combo = 0;
        damage[event.player] += 1;
      }
    }

    for (const p of [1,2]) state.players[p].hp = Math.max(0, state.players[p].hp - damage[p]);

    if (state.players[1].hp === 0 || state.players[2].hp === 0) {
      state.running = false;
      state.over = true;
      state.winner = state.players[1].hp === 0 && state.players[2].hp === 0 ? 0 : (state.players[1].hp === 0 ? 2 : 1);
    }

    renderAllState();
    for (const p of [1,2]) {
      for (let idx = oldHp[p] - 1; idx >= state.players[p].hp; idx--) FX.breakHeart(p, idx);
    }
    events.forEach(combatAnimation);

    if (state.mode === 'online' && state.role === 'host') {
      for (const event of events) await Net.sendCombat(event);
      await Net.sendState(snapshot(events));
    }

    if (!state.over) {
      for (const event of events) {
        if (state.mode === 'local' || (state.mode === 'online' && state.role === 'host' && event.player === 1)) {
          setTimeout(()=>nextQuestion(event.player), 620);
        }
      }
    } else {
      setTimeout(()=>showResult(state.winner), 700);
    }
  }

  async function countdown() {
    const overlay = $('countdownOverlay');
    const number = $('countdownNumber');
    overlay.hidden = false;
    for (const item of ['3','2','1','GO!']) {
      number.textContent = item;
      number.style.animation = 'none';
      void number.offsetWidth;
      number.style.animation = '';
      await sleep(item === 'GO!' ? 520 : 700);
    }
    overlay.hidden = true;
  }

  async function beginPlayableMatch() {
    setScreen('gameScreen');
    renderAllState();
    setOnlinePanelRoles();
    $('gameBoard').classList.toggle('tabletop', state.mode === 'local' && state.deviceMode === 'tabletop');
    $('modeLabel').textContent = state.mode === 'local' ? (state.deviceMode === 'tabletop' ? '同機・平板桌遊' : '同機雙人') : 'Supabase 連線';
    $('difficultyLabel').textContent = DIFFICULTY_LABEL[state.difficulty];
    $('onlineRoomMeta').hidden = state.mode !== 'online';
    $('gameRoomCode').textContent = state.roomCode || '------';
    fitTabletRotators();

    await countdown();
    if (state.over) return;
    state.running = true;
    if (state.mode === 'local') {
      nextQuestion(1); nextQuestion(2);
    } else {
      nextQuestion(state.localPlayer);
      if (state.role === 'host') Net.sendState(snapshot([]));
    }
  }

  function makeRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    for (const b of bytes) code += chars[b % chars.length];
    return code;
  }

  async function startLocal() {
    await Audio.unlock();
    state.mode='local'; state.role='local'; state.localPlayer=null; state.roomCode=null;
    resetPlayers();
    await beginPlayableMatch();
  }

  async function createRoom() {
    await Audio.unlock();
    if (!Net.isConfigured()) {
      setSupabaseStatus('尚未設定 Supabase。請先修改 js/config.js。', true);
      return;
    }
    const roomCode = makeRoomCode();
    const animals = chooseAnimals();
    pendingHostMeta = {difficulty:state.difficulty, animals};
    state.mode='online'; state.role='host'; state.localPlayer=1; state.roomCode=roomCode;
    resetPlayers(animals);
    $('roomCodeDisplay').textContent = roomCode;
    $('lobbyTitle').textContent = '等待對手加入';
    $('lobbyText').textContent = '把這個 6 碼房號分享給另一位玩家。';
    setScreen('lobbyScreen');
    try {
      await Net.hostRoom(roomCode, pendingHostMeta);
      updateConnectionPill(true, roomCode);
    } catch (err) {
      console.error(err);
      setScreen('setupScreen');
      setSupabaseStatus(`連線失敗：${err.message}`, true);
    }
  }

  async function joinRoom() {
    await Audio.unlock();
    if (!Net.isConfigured()) {
      setSupabaseStatus('尚未設定 Supabase。請先修改 js/config.js。', true);
      return;
    }
    const code = $('roomCodeInput').value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);
    $('roomCodeInput').value = code;
    if (code.length !== 6) {
      setSupabaseStatus('請輸入完整的 6 碼房間代碼。', true);
      return;
    }
    state.mode='online'; state.role='guest'; state.localPlayer=2; state.roomCode=code;
    $('roomCodeDisplay').textContent = code;
    $('lobbyTitle').textContent = '正在尋找房主';
    $('lobbyText').textContent = '已連上 Realtime，正在確認房間是否存在…';
    setScreen('lobbyScreen');
    try {
      await Net.joinRoom(code);
      updateConnectionPill(true, code);
    } catch (err) {
      console.error(err);
      setScreen('setupScreen');
      setSupabaseStatus(`連線失敗：${err.message}`, true);
    }
  }

  async function beginOnlineAsHost() {
    state.difficulty = pendingHostMeta.difficulty;
    resetPlayers(pendingHostMeta.animals);
    const payload = {
      difficulty:state.difficulty,
      animals:pendingHostMeta.animals,
      roomCode:state.roomCode
    };
    await Net.sendStart(payload);
    await beginPlayableMatch();
  }

  async function beginOnlineAsGuest(payload) {
    state.mode='online'; state.role='guest'; state.localPlayer=2;
    state.difficulty=payload.difficulty; state.roomCode=payload.roomCode || state.roomCode;
    resetPlayers(payload.animals);
    await beginPlayableMatch();
  }

  function applyRemoteState(payload) {
    if (state.role !== 'guest' || !payload) return;
    const old = {1:state.players[1].hp,2:state.players[2].hp};
    state.players[1].hp = payload.hp1;
    state.players[2].hp = payload.hp2;
    state.players[1].combo = payload.combo1;
    state.players[2].combo = payload.combo2;
    state.running = payload.running;
    state.over = payload.over;
    state.winner = payload.winner;
    renderAllState();
    for (const p of [1,2]) {
      for (let idx = old[p]-1; idx >= state.players[p].hp; idx--) FX.breakHeart(p, idx);
    }

    const resolved = payload.resolvedEvents || [];
    if (pendingRemoteAnswer && resolved.some(e => e.eventId === pendingRemoteAnswer.eventId)) {
      pendingRemoteAnswer = null;
      if (!state.over) setTimeout(()=>nextQuestion(2), 620);
    }
    if (state.over) setTimeout(()=>showResult(state.winner), 700);
  }

  function showResult(winner) {
    state.running=false; state.over=true; state.winner=winner;
    const local = state.mode === 'online' ? state.localPlayer : null;
    if (winner === 0) {
      $('resultEyebrow').textContent='DRAW';
      $('resultTitle').textContent='平手！';
      $('resultText').textContent='雙方在幾乎同一時間耗盡 HP。';
    } else {
      $('resultEyebrow').textContent='VICTORY';
      $('resultTitle').textContent = local ? (winner === local ? '你獲勝！' : '對手獲勝！') : `Player ${winner} 獲勝！`;
      $('resultText').textContent = winner === local || !local ? '元素知識就是你的超能力。' : '再來一局，把元素知識搶回來！';
      FX.celebrate(winner);
      Audio.victory();
    }
    const rematch = $('rematchBtn');
    if (state.mode === 'online' && state.role === 'guest') {
      rematch.disabled = true; rematch.textContent='等待房主再戰';
    } else {
      rematch.disabled = false; rematch.textContent='再玩一次';
    }
    $('resultOverlay').hidden=false;
  }

  async function rematch() {
    $('resultOverlay').hidden=true;
    if (state.mode === 'local') {
      resetPlayers();
      await beginPlayableMatch();
      return;
    }
    if (state.mode === 'online' && state.role === 'host') {
      const animals=chooseAnimals();
      resetPlayers(animals);
      pendingHostMeta = {difficulty:state.difficulty, animals};
      await Net.sendRematch({difficulty:state.difficulty, animals, roomCode:state.roomCode});
      await beginPlayableMatch();
    }
  }

  async function backToSetup() {
    $('resultOverlay').hidden=true;
    state.running=false; state.over=false;
    if (state.mode === 'online') await Net.disconnect();
    updateConnectionPill(false);
    setScreen('setupScreen');
  }

  function setupChoiceGroup(containerId, stateKey) {
    const container=$(containerId);
    container.addEventListener('click', e => {
      const btn=e.target.closest('[data-value]'); if (!btn) return;
      for (const item of container.querySelectorAll('[data-value]')) {
        const on=item===btn; item.classList.toggle('is-selected',on); item.setAttribute('aria-checked',String(on));
      }
      state[stateKey]=btn.dataset.value;
      if (stateKey==='playMode') updateSetupVisibility();
    });
  }

  function updateSetupVisibility() {
    const online=state.playMode==='online';
    $('deviceModeCard').hidden=online;
    $('localStartArea').hidden=online;
    $('onlineCard').hidden=!online;
    if (online) checkSupabaseConfig();
  }

  function setSupabaseStatus(text, error=false) {
    const el=$('supabaseStatus'); el.textContent=text;
    el.classList.toggle('is-ready',!error); el.classList.toggle('is-error',error);
  }

  function checkSupabaseConfig() {
    if (Net.isConfigured()) setSupabaseStatus('✓ Supabase 已設定，可建立／加入房間。', false);
    else setSupabaseStatus('尚未設定：請在 js/config.js 填入 Project URL 與 publishable key。', true);
  }

  function updateConnectionPill(connected, code='') {
    const pill=$('connectionPill'); pill.hidden=!connected;
    pill.textContent=connected ? `● 已連線 ${code}` : '● 離線';
  }

  function fitTabletRotators() {
    if (!$('gameBoard').classList.contains('tabletop')) return;
    for (const p of [1,2]) {
      const panel=$(`player${p}Panel`); const rot=panel.querySelector('.player-rotator');
      const w=panel.clientWidth, h=panel.clientHeight;
      if (!w || !h) continue;
      const scale=Math.min(w/h, h/w) * .95;
      rot.style.setProperty('--tablet-scale', String(Math.max(.48, Math.min(.95, scale))));
    }
  }

  function initializeNetworkHandlers() {
    Net.on('guest_joined', async () => {
      $('lobbyTitle').textContent='對手已加入！';
      $('lobbyText').textContent='連線成功，準備開始對戰。';
      await sleep(450);
      beginOnlineAsHost();
    });
    Net.on('welcome', payload => {
      pendingHostMeta=payload.meta;
      $('lobbyTitle').textContent='已加入房間';
      $('lobbyText').textContent='等待房主開始遊戲…';
    });
    Net.on('start_game', payload => {
      if (state.role==='guest') beginOnlineAsGuest(payload);
    });
    Net.on('answer_event', payload => {
      if (state.role==='host' && state.running && !state.over) queueCombat({player:2, correct:!!payload.correct, eventId:payload.eventId});
    });
    Net.on('state', payload => applyRemoteState(payload));
    Net.on('combat_event', event => {
      if (state.role==='guest') combatAnimation(event);
    });
    Net.on('rematch', payload => {
      if (state.role!=='guest') return;
      $('resultOverlay').hidden=true;
      state.difficulty=payload.difficulty;
      resetPlayers(payload.animals);
      beginPlayableMatch();
    });
    Net.on('room_full', async () => {
      await Net.disconnect(false); updateConnectionPill(false); setScreen('setupScreen');
      setSupabaseStatus('這個房間已經有兩位玩家，請使用其他房號。', true);
    });
    Net.on('host_not_found', async () => {
      if (state.role!=='guest' || state.running) return;
      await Net.disconnect(false); updateConnectionPill(false); setScreen('setupScreen');
      setSupabaseStatus('找不到房主。請檢查房號，或請房主重新建立房間。', true);
    });
    Net.on('leave_game', () => {
      if (state.mode!=='online') return;
      state.running=false; state.over=true;
      $('resultEyebrow').textContent='DISCONNECTED';
      $('resultTitle').textContent='對手已離線';
      $('resultText').textContent='這一局已停止，可返回設定重新連線。';
      $('rematchBtn').disabled=true;
      $('rematchBtn').textContent='無法再戰';
      $('resultOverlay').hidden=false;
    });
  }

  function initializeUI() {
    setupChoiceGroup('playModeSelector','playMode');
    setupChoiceGroup('difficultySelector','difficulty');
    setupChoiceGroup('deviceModeSelector','deviceMode');

    $('startLocalBtn').addEventListener('click',startLocal);
    $('createRoomBtn').addEventListener('click',createRoom);
    $('joinRoomBtn').addEventListener('click',joinRoom);
    $('roomCodeInput').addEventListener('keydown',e=>{ if(e.key==='Enter') joinRoom(); });
    $('roomCodeInput').addEventListener('input',e=>{ e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6); });
    $('copyCodeBtn').addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(state.roomCode || $('roomCodeDisplay').textContent); $('copyCodeBtn').textContent='已複製！'; setTimeout(()=>$('copyCodeBtn').textContent='複製房號',1200); }
      catch { $('copyCodeBtn').textContent='請手動複製'; }
    });
    $('cancelLobbyBtn').addEventListener('click',backToSetup);
    $('quitGameBtn').addEventListener('click',backToSetup);
    $('backSetupBtn').addEventListener('click',backToSetup);
    $('rematchBtn').addEventListener('click',rematch);

    $('soundToggle').addEventListener('click',async()=>{
      await Audio.unlock(); Audio.setEnabled(!Audio.enabled);
      $('soundToggle').textContent=Audio.enabled?'🔊':'🔇'; $('soundToggle').setAttribute('aria-pressed',String(Audio.enabled));
    });
    $('motionToggle').addEventListener('click',()=>{
      const reduced=document.body.classList.toggle('reduce-motion');
      $('motionToggle').textContent=reduced?'◻️':'✨'; $('motionToggle').setAttribute('aria-pressed',String(reduced));
    });

    addEventListener('resize',()=>requestAnimationFrame(fitTabletRotators));
    addEventListener('orientationchange',()=>setTimeout(fitTabletRotators,180));
    checkSupabaseConfig();
    renderAllState();
  }

  initializeNetworkHandlers();
  initializeUI();
})();

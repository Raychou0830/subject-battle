(() => {
  const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  class BattleNetwork {
    constructor() {
      this.client = null;
      this.channel = null;
      this.roomCode = null;
      this.role = null;
      this.clientId = randomId();
      this.guestClientId = null;
      this.connected = false;
      this.handlers = new Map();
      this.helloTimer = null;
      this.hostMeta = null;
    }

    isConfigured() {
      const cfg = window.APP_CONFIG || {};
      return !!(cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && window.supabase?.createClient);
    }

    on(name, fn) { this.handlers.set(name, fn); return this; }
    emit(name, payload) { const fn = this.handlers.get(name); if (fn) fn(payload); }

    ensureClient() {
      if (!this.isConfigured()) throw new Error('尚未設定 Supabase URL / publishable key。');
      if (!this.client) {
        const cfg = window.APP_CONFIG;
        this.client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
      }
      return this.client;
    }

    async hostRoom(roomCode, meta) {
      await this.disconnect(false);
      this.role = 'host';
      this.roomCode = roomCode;
      this.hostMeta = meta;
      await this.#connect();
      return true;
    }

    async joinRoom(roomCode) {
      await this.disconnect(false);
      this.role = 'guest';
      this.roomCode = roomCode;
      await this.#connect();
      this.#startHelloLoop();
      return true;
    }

    async #connect() {
      const client = this.ensureClient();
      const topic = `element-battle:${this.roomCode}`;
      this.channel = client.channel(topic, {
        config: {
          broadcast: { self: false, ack: true },
          presence: { key: this.clientId }
        }
      });

      this.channel
        .on('broadcast', {event:'hello'}, ({payload}) => this.#onHello(payload))
        .on('broadcast', {event:'welcome'}, ({payload}) => this.#onWelcome(payload))
        .on('broadcast', {event:'room_full'}, ({payload}) => this.#onRoomFull(payload))
        .on('broadcast', {event:'start_game'}, ({payload}) => this.emit('start_game', payload))
        .on('broadcast', {event:'answer_event'}, ({payload}) => this.#onAnswer(payload))
        .on('broadcast', {event:'state'}, ({payload}) => this.emit('state', payload))
        .on('broadcast', {event:'combat_event'}, ({payload}) => this.emit('combat_event', payload))
        .on('broadcast', {event:'rematch'}, ({payload}) => this.emit('rematch', payload))
        .on('broadcast', {event:'leave_game'}, ({payload}) => this.emit('leave_game', payload))
        .on('presence', {event:'sync'}, () => this.emit('presence', this.channel.presenceState()));

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(()=>reject(new Error('連線 Supabase Realtime 逾時。')), 10000);
        this.channel.subscribe(async status => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            this.connected = true;
            await this.channel.track({clientId:this.clientId, role:this.role, onlineAt:new Date().toISOString()});
            this.emit('connected', {role:this.role, roomCode:this.roomCode});
            resolve();
          } else if (['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)) {
            clearTimeout(timeout);
            if (!this.connected) reject(new Error(`Realtime 狀態：${status}`));
          }
        });
      });
    }

    #onHello(payload) {
      if (this.role !== 'host' || !payload?.clientId) return;
      if (!this.guestClientId) {
        this.guestClientId = payload.clientId;
        this.send('welcome', {target:payload.clientId, hostClientId:this.clientId, meta:this.hostMeta});
        this.emit('guest_joined', {clientId:payload.clientId});
      } else if (this.guestClientId !== payload.clientId) {
        this.send('room_full', {target:payload.clientId});
      } else {
        this.send('welcome', {target:payload.clientId, hostClientId:this.clientId, meta:this.hostMeta});
      }
    }

    #onWelcome(payload) {
      if (this.role !== 'guest' || payload?.target !== this.clientId) return;
      clearInterval(this.helloTimer); this.helloTimer = null;
      this.emit('welcome', payload);
    }

    #onRoomFull(payload) {
      if (this.role === 'guest' && payload?.target === this.clientId) this.emit('room_full', payload);
    }

    #onAnswer(payload) {
      if (this.role !== 'host') return;
      if (payload?.clientId !== this.guestClientId) return;
      this.emit('answer_event', payload);
    }

    #startHelloLoop() {
      let attempts = 0;
      const sendHello = () => {
        attempts++;
        this.send('hello', {clientId:this.clientId});
        if (attempts >= 8) {
          clearInterval(this.helloTimer); this.helloTimer = null;
          this.emit('host_not_found', {});
        }
      };
      sendHello();
      this.helloTimer = setInterval(sendHello, 1200);
    }

    async send(event, payload = {}) {
      if (!this.channel || !this.connected) return false;
      const status = await this.channel.send({type:'broadcast', event, payload});
      return status === 'ok';
    }

    sendAnswer(correct, eventId) {
      return this.send('answer_event', {clientId:this.clientId, player:2, correct:!!correct, eventId});
    }

    sendState(state) { return this.send('state', state); }
    sendCombat(event) { return this.send('combat_event', event); }
    sendStart(payload) { return this.send('start_game', payload); }
    sendRematch(payload) { return this.send('rematch', payload); }

    async disconnect(notify = true) {
      clearInterval(this.helloTimer); this.helloTimer = null;
      if (this.channel) {
        if (notify && this.connected) {
          try { await this.send('leave_game', {clientId:this.clientId, role:this.role}); } catch (_) {}
        }
        try { await this.channel.untrack(); } catch (_) {}
        try { await this.client?.removeChannel(this.channel); } catch (_) {}
      }
      this.channel = null;
      this.connected = false;
      this.guestClientId = null;
      this.hostMeta = null;
    }
  }

  window.ElementBattleNetwork = new BattleNetwork();
})();

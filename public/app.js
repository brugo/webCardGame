const app = document.querySelector("#app");

const local = {
  sessionId: window.localStorage.getItem("tcg.sessionId") || "",
  playerId: window.localStorage.getItem("tcg.playerId") || "",
  token: window.localStorage.getItem("tcg.token") || "",
  playerName: window.localStorage.getItem("tcg.playerName") || "",
  error: "",
  toast: "",
  toastTone: "warning",
  rulesOpen: false,
  rulesQuery: "",
  rulesTab: "manual",
  rulesSelectedHero: "guardiao",
  state: null,
  events: null,
  justPlayedUid: "",
  selectedCardUid: "",
  seenVisualEventIds: new Set(),
  completedVisualEventIds: new Set(),
  previousMeters: {},
  roomCards: [],
  trapCards: [],
  intentionCards: [],
  heroes: [],
  heroCards: {},
  // Cinematic animation system
  animQueue: [],
  animRunning: false,
  lastTurn: null,
  lastRoomNumber: null,
  lastStatus: null,
  newlyEnteredEnemies: new Set(),
  revealedEnemyUids: new Set(),
  roomStartInProgress: false,
  visualLife: {},
  visualShield: {},
  quitConfirmOpen: false
};

const cardArt = "/assets/hero-card-example.png";
const enemyArt = "/assets/enemy-card-example.png";
const trapArts = ["/assets/trap-card-1.png", "/assets/trap-card-2.png"];

function getCardArt(card) {
  if (card) {
    if (card.heroId === "guardiao") return "/assets/guardiao-card.jpg";
    if (card.heroId === "batedor") return "/assets/batedor-card.jpg";
    if (card.heroId === "mago") return "/assets/mago-card.jpg";
    if (card.heroId === "oraculo") return "/assets/oraculo-card.jpg";
  }
  return cardArt;
}

function getHeroCardArt(heroId) {
  if (heroId === "guardiao") return "/assets/guardiao-card.jpg";
  if (heroId === "batedor") return "/assets/batedor-card.jpg";
  if (heroId === "mago") return "/assets/mago-card.jpg";
  if (heroId === "oraculo") return "/assets/oraculo-card.jpg";
  return "/assets/hero-card-example.png";
}

function getEnemyArt(enemy) {
  if (enemy) {
    if (enemy.id === "sentinela") return "/assets/sentinela-oco.jpg";
    if (enemy.id === "salteador") return "/assets/salteador-cinzento.jpg";
    if (enemy.id === "bruxa") return "/assets/bruxa-do-breu.jpg";
    if (enemy.id === "carcereiro") return "/assets/carcereiro-ferrugem.jpg";
    if (enemy.id === "mistico") return "/assets/mistico-penumbra.jpg";
    if (enemy.id === "arauto") return "/assets/arauto-cinza.jpg";
    if (enemy.id === "colosso") return "/assets/colosso-cinzas.jpg";
    if (enemy.id === "executor") return "/assets/executor-sombrio.jpg";
    if (enemy.id === "basilisco") return "/assets/basilisco-azul.jpg";
  }
  return enemyArt;
}

const glossaryEntries = [
  ["Vida", "Quantidade de dano que um personagem pode sofrer antes de ser derrotado."],
  ["Escudo X", "Receba X pontos de Escudo. O Escudo absorve dano antes da Vida e e removido quando chega a zero."],
  ["Cura X", "Recupere X pontos de Vida, sem ultrapassar a Vida maxima."],
  ["Dano X", "Cause X pontos de dano ao alvo."],
  ["Dano em Area X", "Cause X pontos de dano em todos os inimigos."],
  ["Comprar X", "Compre X cartas do seu deck."],
  ["Descartar X", "Escolha X cartas da mao e coloque-as no descarte."],
  ["Recuperar Energia X", "Ganhe X de Energia imediatamente."],
  ["Reacao", "Pode ser usada fora do seu turno quando seu gatilho acontecer."],
  ["Permanente", "Permanece em jogo ate ser removida."],
  ["Suprema", "Carta exclusiva do heroi. Nao faz parte do deck e pode ser usada apenas uma vez por partida."],
  ["Exaurir", "Apos resolver seu efeito, esta carta e removida da partida."],
  ["Provocar", "Escolha um aliado. Ate o inicio do seu proximo turno, todo dano que ele receber seria causado a voce."],
  ["Interceptar", "Quando um aliado sofreria dano, anule esse dano e voce sofre esse dano."],
  ["Refletir X", "Sempre que sofrer dano, cause X de dano ao atacante."],
  ["Ignorar Escudo", "O dano reduz diretamente a Vida do alvo."],
  ["Reduzir Dano X", "Todo dano recebido e reduzido em X, minimo 1."],
  ["Imunidade", "O personagem nao pode sofrer dano."],
  ["Reviver X", "Traga um heroi derrotado de volta com X de Vida."],
  ["Preparar", "Compre 1 carta e descarte 1 carta."],
  ["Fortificar", "Receba Escudo 2 e compre 1 carta."],
  ["Inimigo Comum", "Inimigo basico."],
  ["Inimigo Brutal", "Inimigo mais resistente."],
  ["Elite", "Categoria futura."],
  ["Chefe", "Ultimo inimigo da dungeon."],
  ["Blindado X", "Entra em jogo com X de Escudo."],
  ["Enfurecido", "Recebe o bonus descrito quando estiver com metade da Vida ou menos."],
  ["Veloz", "Ataca antes dos demais inimigos."],
  ["Invocar", "Coloque um novo inimigo em jogo."],
  ["Explodir X", "Ao morrer, causa X de dano em todos os herois."],
  ["Instantanea", "Armadilha que resolve seu efeito imediatamente."],
  ["Persistente", "Armadilha que permanece ativa."],
  ["Desarmar", "Remove uma armadilha ativa."],
  ["Carta de Sala", "Define setup, objetivo, regra especial e recompensa."],
  ["Carta de Intencao", "Define o comportamento dos inimigos da rodada."],
  ["Descanso", "Apos concluir uma sala, o grupo escolhe um beneficio."],
  ["Recompensa", "Beneficio recebido ao concluir uma sala."],
  ["Energia", "Recurso usado para jogar cartas. Cada heroi inicia o turno com sua Energia maxima (Donovan: 4, Niely: 5, Elerion: 4, Arcanista: 6). Ela e restaurada a cada rodada e nao acumula."],
  ["Custos", "0 Energia: Reacoes. 1 Energia: acoes simples. 2 Energias: acoes poderosas."]
];

function saveAuth(auth) {
  local.sessionId = auth.sessionId;
  local.playerId = auth.playerId;
  local.token = auth.token;
  window.localStorage.setItem("tcg.sessionId", auth.sessionId);
  window.localStorage.setItem("tcg.playerId", auth.playerId);
  window.localStorage.setItem("tcg.token", auth.token);
}

function clearAuth() {
  local.events?.close();
  local.events = null;
  local.sessionId = "";
  local.playerId = "";
  local.token = "";
  local.state = null;
  local.error = "";
  local.seenVisualEventIds.clear();
  local.completedVisualEventIds.clear();
  local.previousMeters = {};
  local.quitConfirmOpen = false;
  local.animQueue = [];
  local.animRunning = false;
  const overlay = document.getElementById("cinematic-overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }
  window.localStorage.removeItem("tcg.sessionId");
  window.localStorage.removeItem("tcg.playerId");
  window.localStorage.removeItem("tcg.token");
  render();
}

async function loadCards() {
  try {
    const data = await api("/api/cards");
    local.roomCards = data.roomCards || [];
    local.trapCards = data.trapCards || [];
    local.intentionCards = data.intentionCards || [];
    local.heroes = data.heroes || [];
    local.heroCards = data.heroCards || {};
    render();
  } catch (err) {
    console.error("Erro ao carregar as cartas da biblioteca:", err);
  }
}
loadCards();

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Erro inesperado.");
  return body;
}

async function action(payload) {
  try {
    local.error = "";
    const state = await api(`/api/sessions/${local.sessionId}/action`, {
      method: "POST",
      body: JSON.stringify({
        playerId: local.playerId,
        token: local.token,
        ...payload
      })
    });
    if (payload.type === "playCard") {
      local.justPlayedUid = payload.cardUid;
      local.selectedCardUid = "";
      window.setTimeout(() => {
        local.justPlayedUid = "";
        render();
      }, 900);
    }
    setState(state);
  } catch (error) {
    local.error = error.message;
    showToast(error.message);
    render();
  }
}

function showToast(message, tone = "warning") {
  local.toast = message;
  local.toastTone = tone;
  window.clearTimeout(local.toastTimer);
  local.toastTimer = window.setTimeout(() => {
    local.toast = "";
    render();
  }, 2600);
}

function connectEvents() {
  if (!local.sessionId || local.events) return;
  local.events = new EventSource(
    `/api/sessions/${local.sessionId}/events?playerId=${local.playerId}&token=${local.token}`
  );
  local.events.addEventListener("state", (event) => {
    setState(JSON.parse(event.data));
  });
  local.events.onerror = () => {
    if (!local.state) {
      local.events?.close();
      local.events = null;
      local.error = "Nao foi possivel reconectar nessa sala. Crie ou entre em outra sala.";
      clearSavedSession();
      render();
      return;
    }
    local.error = "Conexao da sala interrompida. Recarregue se ela nao voltar.";
    render();
  };
}

function clearSavedSession() {
  local.sessionId = "";
  local.playerId = "";
  local.token = "";
  local.state = null;
  local.quitConfirmOpen = false;
  local.animQueue = [];
  local.animRunning = false;
  local.seenVisualEventIds.clear();
  local.completedVisualEventIds.clear();
  const overlay = document.getElementById("cinematic-overlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay.innerHTML = "";
  }
  window.localStorage.removeItem("tcg.sessionId");
  window.localStorage.removeItem("tcg.playerId");
  window.localStorage.removeItem("tcg.token");
}

function pct(value, max) {
  if (!max) return "0%";
  return `${Math.max(0, Math.min(100, Math.round((value / max) * 100)))}%`;
}

function collectMeterValues(state) {
  const values = {};
  state?.players?.forEach((player) => {
    values[`hero-${player.id}-life`] = pct(player.life || 0, player.maxLife || 1);
    values[`hero-${player.id}-energy`] = pct(player.energy || 0, player.maxEnergy || 1);
  });
  state?.enemies?.forEach((enemy) => {
    values[`enemy-${enemy.uid}-life`] = pct(enemy.life || 0, enemy.maxLife || 1);
  });
  return values;
}

async function runCinematic(fn) {
  local.animRunning = true;
  try {
    await fn();
  } catch (err) {
    if (err.message !== "CinematicAborted") {
      console.error(err);
    }
  } finally {
    local.animRunning = false;
    // Overwrite visual state with actual state to guarantee sync
    if (local.state) {
      (local.state.players || []).forEach(p => {
        local.visualLife[p.id] = p.life;
        local.visualShield[p.id] = p.shield;
      });
      (local.state.enemies || []).forEach(e => {
        local.visualLife[e.uid] = e.life;
        local.visualShield[e.uid] = e.shield;
      });
    }
    render();

    // Process next queued state if any
    if (local.animQueue.length > 0 && local.sessionId) {
      const nextQueuedState = local.animQueue.shift();
      window.setTimeout(() => {
        setState(nextQueuedState);
      }, 0);
    }
  }
}

function getVisualLife(id, actualValue) {
  if (local.visualLife && local.visualLife[id] !== undefined) {
    return local.visualLife[id];
  }
  return actualValue;
}

function getVisualShield(id, actualValue) {
  if (local.visualShield && local.visualShield[id] !== undefined) {
    return local.visualShield[id];
  }
  return actualValue;
}

function applyEventToVisualState(event, state) {
  const targetId = event.targetId;
  const amount = event.amount;

  if (event.targetType === "hero" || event.targetType === "player") {
    const player = state.players.find(p => p.id === targetId);
    if (!player) return;
    
    if (local.visualLife[targetId] === undefined) local.visualLife[targetId] = player.life;
    if (local.visualShield[targetId] === undefined) local.visualShield[targetId] = player.shield;

    if (event.type === "damage") {
      let dmg = amount;
      const currentShield = local.visualShield[targetId] || 0;
      const blocked = Math.min(currentShield, dmg);
      local.visualShield[targetId] = currentShield - blocked;
      dmg -= blocked;
      local.visualLife[targetId] = Math.max(0, (local.visualLife[targetId] || 0) - dmg);
    } else if (event.type === "heal") {
      local.visualLife[targetId] = Math.min(player.maxLife, (local.visualLife[targetId] || 0) + amount);
    } else if (event.type === "shield") {
      local.visualShield[targetId] = amount;
    }
  } else if (event.targetType === "enemy") {
    const enemy = state.enemies.find(e => e.uid === targetId);
    if (!enemy) return;

    if (local.visualLife[targetId] === undefined) local.visualLife[targetId] = enemy.life;
    if (local.visualShield[targetId] === undefined) local.visualShield[targetId] = enemy.shield;

    if (event.type === "damage") {
      let dmg = amount;
      const currentShield = local.visualShield[targetId] || 0;
      const blocked = Math.min(currentShield, dmg);
      local.visualShield[targetId] = currentShield - blocked;
      dmg -= blocked;
      local.visualLife[targetId] = Math.max(0, (local.visualLife[targetId] || 0) - dmg);
    } else if (event.type === "heal") {
      local.visualLife[targetId] = Math.min(enemy.maxLife, (local.visualLife[targetId] || 0) + amount);
    } else if (event.type === "shield") {
      local.visualShield[targetId] = amount;
    }
  }
}

function isStateIdentical(s1, s2) {
  if (!s1 || !s2) return false;
  if (s1.turn !== s2.turn) return false;
  if (s1.round !== s2.round) return false;
  if (s1.dungeonResolved !== s2.dungeonResolved) return false;
  if (s1.roomNumber !== s2.roomNumber) return false;
  if (s1.status !== s2.status) return false;
  
  const pId1 = s1.pendingReaction?.id;
  const pId2 = s2.pendingReaction?.id;
  if (pId1 !== pId2) return false;
  
  if (s1.pendingShieldAllocation?.cardUid !== s2.pendingShieldAllocation?.cardUid) return false;
  if (s1.pendingEnergyAllocation?.cardUid !== s2.pendingEnergyAllocation?.cardUid) return false;
  if (s1.pendingEcoArcano?.cardUid !== s2.pendingEcoArcano?.cardUid) return false;
  if (s1.pendingDistorcaoTemporal?.casterId !== s2.pendingDistorcaoTemporal?.casterId) return false;
  
  const ev1 = s1.visualEvents || [];
  const ev2 = s2.visualEvents || [];
  if (ev1.length !== ev2.length) return false;
  if (ev1.length > 0 && ev1[ev1.length - 1].id !== ev2[ev2.length - 1].id) return false;
  
  const arena1 = s1.arena || [];
  const arena2 = s2.arena || [];
  if (arena1.length !== arena2.length) return false;
  if (arena1.length > 0 && arena1[0].uid !== arena2[0].uid) return false;

  const log1 = s1.log || [];
  const log2 = s2.log || [];
  if (log1.length !== log2.length) return false;
  if (log1.length > 0 && log1[0] !== log2[0]) return false;

  const pl1 = s1.players || [];
  const pl2 = s2.players || [];
  if (pl1.length !== pl2.length) return false;
  for (let i = 0; i < pl1.length; i++) {
    const p1 = pl1[i];
    const p2 = pl2[i];
    if (p1.id !== p2.id) return false;
    if (p1.life !== p2.life) return false;
    if (p1.shield !== p2.shield) return false;
    if (p1.energy !== p2.energy) return false;
    if (p1.turnEnded !== p2.turnEnded) return false;
    if (p1.handCount !== p2.handCount) return false;
    if (p1.discardCount !== p2.discardCount) return false;
    if ((p1.played || []).length !== (p2.played || []).length) return false;
  }

  const en1 = s1.enemies || [];
  const en2 = s2.enemies || [];
  if (en1.length !== en2.length) return false;
  for (let i = 0; i < en1.length; i++) {
    const e1 = en1[i];
    const e2 = en2[i];
    if (e1.uid !== e2.uid) return false;
    if (e1.life !== e2.life) return false;
    if (e1.shield !== e2.shield) return false;
    if (e1.isStunned !== e2.isStunned) return false;
    if (e1.forcedTargetId !== e2.forcedTargetId) return false;
  }
  
  return true;
}

function isTargetAnimating(targetId, targetType, state) {
  return (state?.visualEvents || []).some(ev => 
    ev.targetId === targetId && 
    (ev.targetType === targetType || 
     (targetType === "hero" && ev.targetType === "player") || 
     (targetType === "player" && ev.targetType === "hero")) && 
    !local.completedVisualEventIds.has(ev.id)
  );
}

function setState(nextState) {
  if (isStateIdentical(nextState, local.state)) {
    return;
  }

  if (local.animRunning) {
    // Queue state updates received during a cinematic
    local.animQueue.push(nextState);
    return;
  }

  const prevState = local.state;
  local.previousMeters = collectMeterValues(local.state);
  local.state = nextState;

  if (!local.visualLife) local.visualLife = {};
  if (!local.visualShield) local.visualShield = {};

  // First, initialize visual values from prevState if they aren't already set
  if (prevState) {
    (prevState.players || []).forEach(p => {
      if (local.visualLife[p.id] === undefined) local.visualLife[p.id] = p.life;
      if (local.visualShield[p.id] === undefined) local.visualShield[p.id] = p.shield;
    });
    (prevState.enemies || []).forEach(e => {
      if (local.visualLife[e.uid] === undefined) local.visualLife[e.uid] = e.life;
      if (local.visualShield[e.uid] === undefined) local.visualShield[e.uid] = e.shield;
    });
  }

  // Next, make sure everything present in nextState is initialized in visual state
  (nextState.players || []).forEach(p => {
    if (local.visualLife[p.id] === undefined) local.visualLife[p.id] = p.life;
    if (local.visualShield[p.id] === undefined) local.visualShield[p.id] = p.shield;
  });
  (nextState.enemies || []).forEach(e => {
    if (local.visualLife[e.uid] === undefined) local.visualLife[e.uid] = e.life;
    if (local.visualShield[e.uid] === undefined) local.visualShield[e.uid] = e.shield;
  });

  const prevTurn = prevState?.turn;
  const nextTurn = nextState?.turn;
  const prevStatus = prevState?.status;
  const nextStatus = nextState?.status;
  const prevRoom = prevState?.roomNumber;
  const nextRoom = nextState?.roomNumber;
  const prevPending = prevState?.pendingReaction;
  const nextPending = nextState?.pendingReaction;

  // New room / game start
  const isNewRoom = nextStatus === "playing" && (
    prevStatus !== "playing" ||
    (prevRoom !== nextRoom && nextRoom !== local.lastRoomNumber)
  );

  // Dungeon turn just started (players → dungeon)
  const isDungeonTurnStart = prevTurn === "players" && nextTurn === "dungeon";

  // A pendingReaction was resolved AND a new reaction immediately followed (next monster)
  const isReactionResolvedAndNewReaction = nextTurn === "dungeon" && nextPending && prevPending && prevPending.id !== nextPending.id;

  // A new pendingReaction appeared (first one, no previous reaction)
  const isNewReactionOnly = nextTurn === "dungeon" && nextPending && !prevPending;

  // A pendingReaction was resolved and NO new reaction followed (last monster resolved)
  const isReactionResolvedOnly = nextTurn === "dungeon" && !nextPending && prevPending;

  // Hero turn just started (dungeon → players)
  const isHeroTurnStart = prevTurn === "dungeon" && nextTurn === "players";

  const isCinematic = isNewRoom || isDungeonTurnStart || isNewReactionOnly || isReactionResolvedOnly || isReactionResolvedAndNewReaction || isHeroTurnStart;

  // Lock to previous state values if cinematic is starting
  if (isCinematic && prevState) {
    (prevState.players || []).forEach(p => {
      if (local.visualLife[p.id] === undefined) local.visualLife[p.id] = p.life;
      if (local.visualShield[p.id] === undefined) local.visualShield[p.id] = p.shield;
    });
    (prevState.enemies || []).forEach(e => {
      if (local.visualLife[e.uid] === undefined) local.visualLife[e.uid] = e.life;
      if (local.visualShield[e.uid] === undefined) local.visualShield[e.uid] = e.shield;
    });
  }

  // If not cinematic and not running animation, keep visual values in sync (except for targets currently animating)
  if (!isCinematic && !local.animRunning) {
    (nextState.players || []).forEach(p => {
      if (!isTargetAnimating(p.id, "hero", nextState)) {
        local.visualLife[p.id] = p.life;
        local.visualShield[p.id] = p.shield;
      }
    });
    (nextState.enemies || []).forEach(e => {
      if (!isTargetAnimating(e.uid, "enemy", nextState)) {
        local.visualLife[e.uid] = e.life;
        local.visualShield[e.uid] = e.shield;
      }
    });
  }

  if (isNewRoom && nextState?.room) {
    local.lastRoomNumber = nextRoom;
    local.newlyEnteredEnemies.clear();
    runCinematic(() => queueCinematicRoomStart(nextState));

  } else if (isDungeonTurnStart) {
    // Show dungeon banner, then render — first pendingReaction will arrive via SSE shortly
    runCinematic(() => queueCinematicDungeonStart(nextState));

  } else if (isReactionResolvedAndNewReaction) {
    // A previous reaction resolved and a new one immediately started:
    // Resolve the first monster's visual effects, then trigger the second monster's spotlight
    runCinematic(async () => {
      await queueCinematicAfterReaction(nextState);
      await queueCinematicMonsterAttack(nextState);
    });

  } else if (isNewReactionOnly) {
    // First monster about to attack: show its spotlight, THEN show reaction modal
    runCinematic(() => queueCinematicMonsterAttack(nextState));

  } else if (isReactionResolvedOnly) {
    // Reaction decided and no more monster attacks: fire final visual effects
    runCinematic(() => queueCinematicAfterReaction(nextState));

  } else if (isHeroTurnStart) {
    // Show hero turn banner + new intention card reveal
    runCinematic(() => queueCinematicHeroTurn(nextState));

  } else {
    // Normal state update (e.g. hero plays a card, etc.)
    ingestVisualEvents(nextState);
    render();
  }

  local.lastTurn = nextTurn;
  local.lastStatus = nextStatus;
}

function ingestVisualEvents(state) {
  (state?.visualEvents || []).forEach((event) => {
    if (!event.id || local.seenVisualEventIds.has(event.id)) return;
    local.seenVisualEventIds.add(event.id);

    // Delay of 1.5 seconds (1500ms) before the animation triggers
    window.setTimeout(() => {
      // Apply changes to visual state when animation triggers
      applyEventToVisualState(event, state);
      local.completedVisualEventIds.add(event.id);
      render();

      const elId = event.targetType === "enemy" ? `card-enemy-${event.targetId}` : `hud-player-${event.targetId}`;
      const el = document.getElementById(elId);
      if (!el) return;

      // Trigger animation class
      let className = "";
      if (event.type === "damage") className = "effect-hit";
      else if (event.type === "heal") className = "effect-heal";
      else if (event.type === "shield") className = "effect-shield";

      if (className) {
        el.classList.remove("effect-hit", "effect-heal", "effect-shield");
        void el.offsetWidth; // force reflow to restart animation cleanly
        el.classList.add(className);
        window.setTimeout(() => {
          el.classList.remove(className);
        }, event.type === "shield" ? 2500 : 1000);
      }

      // Spawn floating number
      const span = document.createElement("span");
      span.className = `impact-number ${event.type} ${event.targetType}`;
      const sign = event.type === "heal" ? "+" : event.type === "shield" ? "+" : "-";
      const suffix = event.type === "shield" ? " 🛡️" : "";
      span.innerText = `${sign}${event.amount}${suffix}`;

      // Calculate position relative to viewport coordinates (fixed position overlay)
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      span.style.position = "fixed";
      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      span.style.zIndex = "10000";
      span.style.pointerEvents = "none";

      document.body.appendChild(span);
      window.setTimeout(() => {
        span.remove();
      }, 1300);
    }, 1500);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================
// CINEMATIC ANIMATION ENGINE
// ============================================================

function sleep(ms) {
  return new Promise(function(resolve, reject) {
    window.setTimeout(() => {
      if (!local.sessionId) {
        reject(new Error("CinematicAborted"));
      } else {
        resolve();
      }
    }, ms);
  });
}

function getCinematicOverlay() {
  let overlay = document.getElementById("cinematic-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "cinematic-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function showOverlay() {
  const overlay = getCinematicOverlay();
  overlay.className = "fade-in";
  overlay.innerHTML = "";
  overlay.style.display = "flex";
  return overlay;
}

async function hideOverlay() {
  const overlay = document.getElementById("cinematic-overlay");
  if (!overlay) return;
  overlay.className = "fade-out";
  await sleep(400);
  overlay.style.display = "none";
  overlay.innerHTML = "";
}

async function showCinematicBanner(title, subtitle, cssClass, duration) {
  const dur = duration || 3000;
  const overlay = showOverlay();
  let eyebrowText = "🏰 Masmorra";
  if (cssClass === "dungeon-turn") eyebrowText = "⚔️ Fase da Dungeon";
  else if (cssClass === "hero-turn") eyebrowText = "🛡️ Fase dos Heróis";
  const banner = document.createElement("div");
  banner.className = "cinematic-banner enter " + (cssClass || "");
  banner.innerHTML =
    "<span class=\"cinematic-banner-eyebrow\">" + escapeHtml(eyebrowText) + "</span>" +
    "<span class=\"cinematic-banner-title\">" + escapeHtml(title) + "</span>" +
    "<div class=\"cinematic-banner-divider\"></div>" +
    (subtitle ? "<span class=\"cinematic-banner-subtitle\">" + escapeHtml(subtitle) + "</span>" : "");
  overlay.appendChild(banner);
  await sleep(dur);
  banner.classList.remove("enter");
  banner.classList.add("exit");
  await sleep(420);
  await hideOverlay();
}

async function showRoomReveal(room, roomNumber, enemies) {
  const overlay = showOverlay();
  const modal = document.createElement("div");
  modal.className = "room-reveal-modal enter";
  const commonCount = enemies.filter(function(e) { return e.category === "common"; }).length;
  const brutalCount = enemies.filter(function(e) { return e.category === "brutal"; }).length;
  modal.innerHTML =
    "<div class=\"room-reveal-card\">" +
      "<span class=\"room-reveal-label\">Sala " + roomNumber + "</span>" +
      "<h2 class=\"room-reveal-name\">" + escapeHtml(room.name) + "</h2>" +
      (room.subtitle ? "<p class=\"room-reveal-subtitle\">" + escapeHtml(room.subtitle) + "</p>" : "") +
      "<div class=\"room-reveal-setup\">" +
        (commonCount > 0 ? "<span class=\"pill\">\uD83D\uDC64 " + commonCount + " Comum" + (commonCount > 1 ? "ns" : "") + "</span>" : "") +
        (brutalCount > 0 ? "<span class=\"pill\">\uD83D\uDC79 " + brutalCount + " Brutal" + (brutalCount > 1 ? "is" : "") + "</span>" : "") +
      "</div>" +
      (room.rule ? "<p style=\"color:#ffe3a8;font-size:0.88rem;font-weight:800;border-top:1px solid rgba(255,246,223,0.18);padding-top:10px;margin-top:6px;\">" + escapeHtml(room.rule) + "</p>" : "") +
    "</div>";
  overlay.appendChild(modal);
  await sleep(3400);
  modal.classList.remove("enter");
  modal.classList.add("exit");
  await sleep(400);
  await hideOverlay();
}

function buildMonsterCardHtml(enemy) {
  const healthPct = Math.max(0, Math.min(100, Math.round((enemy.life / enemy.maxLife) * 100)));
  return "<article class=\"monster-card " + enemy.category + "\" style=\"pointer-events:none;width:200px;height:290px;border-radius:16px;\">" +
    "<div class=\"monster-art\"><img src=\"" + getEnemyArt(enemy) + "\" alt=\"\" /></div>" +
    "<div class=\"monster-vertical-name\">" + escapeHtml(enemy.name) + "</div>" +
    "<div class=\"monster-badge-left\">" +
      (enemy.shield > 0 ? "<div class=\"stat-badge shield\"><span class=\"badge-bg\">\uD83D\uDEE1\uFE0F</span><span class=\"badge-value\">" + enemy.shield + "</span></div>" : "") +
      "<div class=\"stat-badge attack\"><span class=\"badge-bg\">\u2694\uFE0F</span><span class=\"badge-value\">" + enemy.attack + "</span></div>" +
    "</div>" +
    "<div class=\"monster-health-vial\" style=\"--health-pct:" + healthPct + "%;\">" +
      "<div class=\"vial-liquid\"></div><div class=\"vial-glass\"></div>" +
      "<span class=\"vial-value\">" + enemy.life + "</span>" +
    "</div>" +
  "</article>";
}

function getEnemyActionText(enemy) {
  const name = enemy.name || "Inimigo";
  
  const isHealer = (enemy.keywords && (enemy.keywords.includes("Curandeira") || enemy.keywords.includes("Curandeiro"))) || 
                   (name.includes("Bruxa")) || 
                   (enemy.id === "bruxa");
  if (isHealer) {
    return name + " cura";
  }

  const isShield = (enemy.keywords && (enemy.keywords.includes("Guardiã") || enemy.keywords.includes("Guardião"))) || 
                   (name.includes("Místico") || name.includes("Mistico")) || 
                   (enemy.id === "mistico");
  if (isShield) {
    return name + " da escudos";
  }

  const isBuff = (enemy.keywords && enemy.keywords.some(function(k) { return k.includes("Fortalecer"); })) || 
                 (name.includes("Arauto")) || 
                 (enemy.id === "arauto");
  if (isBuff) {
    return name + " potencializa";
  }

  return name + " ataca";
}

async function showMonsterSpotlight(enemy, actionText, actionTarget) {
  const overlay = showOverlay();
  const modal = document.createElement("div");
  modal.className = "monster-spotlight-modal enter";
  modal.innerHTML =
    "<div class=\"spotlight-card-wrap\">" + buildMonsterCardHtml(enemy) + "</div>" +
    "<div class=\"spotlight-action-text\">" +
      "<span class=\"action-verb\">" + escapeHtml(actionText) + "</span>" +
    "</div>";
  overlay.appendChild(modal);
  await sleep(3000);
  modal.classList.remove("enter");
  modal.classList.add("exit");
  await sleep(400);
  await hideOverlay();
}


async function showMonsterEntrySpotlight(enemy) {
  const overlay = showOverlay();
  const modal = document.createElement("div");
  modal.className = "monster-spotlight-modal enter";
  const entryEnemy = Object.assign({}, enemy, { life: enemy.maxLife });
  const entryHtml = buildMonsterCardHtml(entryEnemy);
  const categoryLabel = enemy.category === "brutal" ? "\uD83D\uDC79 Inimigo Brutal entra na sala!" : "\uD83D\uDC64 Inimigo Comum entra na sala!";
  modal.innerHTML =
    "<span class=\"spotlight-eyebrow\">" + escapeHtml(categoryLabel) + "</span>" +
    "<div class=\"spotlight-card-wrap\">" + entryHtml + "</div>" +
    "<div class=\"spotlight-action-text\">" +
      "<span style=\"color:#fff6df;\">" + escapeHtml(enemy.name) + "</span><br>" +
      "<span style=\"color:#cfc5aa;font-size:0.95rem;font-weight:700;\">\u2764\uFE0F " + enemy.maxLife + " Vida \u00B7 \u2694\uFE0F " + enemy.attack + " Ataque" + (enemy.shield > 0 ? " \u00B7 \uD83D\uDEE1\uFE0F " + enemy.shield + " Escudo" : "") + "</span>" +
    "</div>";
  overlay.appendChild(modal);
  await sleep(2600);
  modal.classList.remove("enter");
  modal.classList.add("exit");
  await sleep(380);
  await hideOverlay();
}

function fireVisualEffect(event) {
  const elId = event.targetType === "enemy" ? ("card-enemy-" + event.targetId) : ("hud-player-" + event.targetId);
  const el = document.getElementById(elId);
  if (!el) return;
  let className = "";
  if (event.type === "damage") className = "effect-hit";
  else if (event.type === "heal") className = "effect-heal";
  else if (event.type === "shield") className = "effect-shield";
  if (className) {
    el.classList.remove("effect-hit", "effect-heal", "effect-shield");
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(function() { el.classList.remove(className); }, event.type === "shield" ? 2500 : 1000);
  }
  const span = document.createElement("span");
  const sign = event.type === "heal" ? "+" : event.type === "shield" ? "+" : "-";
  const suffix = event.type === "shield" ? " \uD83D\uDEE1\uFE0F" : "";
  span.className = "impact-number " + event.type + " " + event.targetType;
  span.innerText = sign + event.amount + suffix;
  const rect = el.getBoundingClientRect();
  span.style.cssText = "position:fixed;z-index:10000;pointer-events:none;left:" + (rect.left + rect.width / 2) + "px;top:" + (rect.top + rect.height / 2) + "px;";
  document.body.appendChild(span);
  window.setTimeout(function() { span.remove(); }, 1300);
}

async function queueCinematicRoomStart(state) {
  const roomNumber = state.roomNumber || 1;
  const room = state.room;
  const enemies = (state.enemies || []).filter(function(e) { return e.life > 0; });

  local.roomStartInProgress = true;
  local.revealedEnemyUids.clear();

  ingestVisualEvents(state);
  render();

  await showCinematicBanner("Iniciando Sala " + roomNumber, room ? room.name : "", "");
  await sleep(200);



  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    await showMonsterEntrySpotlight(enemy);
    
    // Add to revealed set and render so the card fades in/appears on the board
    local.revealedEnemyUids.add(enemy.uid);
    render();

    const cardEl = document.getElementById("card-enemy-" + enemy.uid);
    if (cardEl) {
      cardEl.classList.add("monster-entry-anim");
      window.setTimeout(function() { cardEl.classList.remove("monster-entry-anim"); }, 700);
    }
    await sleep(300);
  }

  local.roomStartInProgress = false;
  render();
}

async function queueCinematicDungeonStart(state) {
  const round = state.round || 1;

  // DON'T ingest visual events yet — we'll fire them per-monster
  render();
  await sleep(300);

  // Show dungeon turn banner
  await showCinematicBanner("Turno " + round + " da Dungeon", "Os inimigos atacam!", "dungeon-turn");

  // Case A: No reactions available — everything resolved instantly by server
  // We need to animate each monster's attack sequentially on the client
  if (!state.pendingReaction && state.dungeonResolved) {
    const enemies = (state.enemies || []).filter(function(e) { return e.life > 0 || e.currentTargetName; });
    const newEvents = (state.visualEvents || []).filter(function(ev) { return !local.seenVisualEventIds.has(ev.id); });
    const usedEventIds = new Set();

    // Show each enemy spotlight and fire their damage events
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.currentTargetName && !enemy.currentTargetHeroId) continue;

      // Find the target player
      const targetPlayer = state.players.find(function(p) {
        return p.name === enemy.currentTargetName || p.heroId === enemy.currentTargetHeroId;
      });

      // Find damage events attributed to this enemy
      const enemyEvents = [];
      newEvents.forEach(function(ev) {
        if (!usedEventIds.has(ev.id) && ev.enemyUid === enemy.uid) {
          enemyEvents.push(ev);
          usedEventIds.add(ev.id);
        }
      });

      // Also match by source name if enemyUid not set
      if (enemyEvents.length === 0 && targetPlayer) {
        newEvents.forEach(function(ev) {
          if (!usedEventIds.has(ev.id) && ev.type === "damage" && ev.targetType === "hero" && ev.targetId === targetPlayer.id && !ev.enemyUid) {
            enemyEvents.push(ev);
            usedEventIds.add(ev.id);
          }
        });
      }

      // Build action text
      let actionText = getEnemyActionText(enemy);

      // Show spotlight for this monster
      await showMonsterSpotlight(enemy, actionText, targetPlayer ? targetPlayer.name : null);

      // Fire visual effects for this enemy's events
      for (let j = 0; j < enemyEvents.length; j++) {
        var ev = enemyEvents[j];
        local.seenVisualEventIds.add(ev.id);
        
        // Apply changes to visual state before firing effect
        applyEventToVisualState(ev, state);
        local.completedVisualEventIds.add(ev.id);
        
        // Render the board with updated visual state so HP bars reflect changes
        render();
        await sleep(50);
        
        fireVisualEffect(ev);
        await sleep(500);
      }
      if (enemyEvents.length > 0) await sleep(500);
    }

    // Fire any remaining global events (trap damage, room effects, etc.)
    for (let k = 0; k < newEvents.length; k++) {
      var gev = newEvents[k];
      if (!local.seenVisualEventIds.has(gev.id) && !usedEventIds.has(gev.id)) {
        local.seenVisualEventIds.add(gev.id);
        applyEventToVisualState(gev, state);
        local.completedVisualEventIds.add(gev.id);
        render();
        await sleep(50);
        fireVisualEffect(gev);
        await sleep(420);
      }
    }

    // Mark all remaining events as seen and completed
    newEvents.forEach(function(ev) {
      local.seenVisualEventIds.add(ev.id);
      local.completedVisualEventIds.add(ev.id);
    });
    render();
    return;
  }

  // Case B: There's a pendingReaction in this initial state — show that monster's spotlight
  if (state.pendingReaction) {
    var pending = state.pendingReaction;
    var enemy = (state.enemies || []).find(function(e) { return e.uid === pending.enemyUid; })
      || { name: pending.enemyName, category: pending.enemyCategory || "common", attack: pending.attack,
           life: 1, maxLife: 1, shield: 0, uid: pending.enemyUid, keywords: [] };

    var actionText2 = getEnemyActionText(enemy);

    await showMonsterSpotlight(enemy, actionText2, pending.targetName);
    
    // Set animRunning to false so that reaction modal can render
    local.animRunning = false;
    render();
    return;
  }

  // Case C: Dungeon turn started but not yet resolved (no pending yet, server will send next state)
  render();
}

async function queueCinematicMonsterAttack(state) {
  const pending = state.pendingReaction;
  if (!pending) {
    ingestVisualEvents(state);
    render();
    return;
  }

  // Find the enemy that's about to attack
  const enemy = (state.enemies || []).find(function(e) { return e.uid === pending.enemyUid; })
    || { name: pending.enemyName, category: pending.enemyCategory || "common", attack: pending.attack,
         life: 1, maxLife: 1, shield: 0, uid: pending.enemyUid, keywords: [] };

  let actionText = getEnemyActionText(enemy);

  // Show the monster spotlight (who will attack and whom)
  await showMonsterSpotlight(enemy, actionText, pending.targetName);

  // Now render the full board INCLUDING the reaction window (pendingReaction is set)
  local.animRunning = false;
  render();
}

async function queueCinematicAfterReaction(state) {
  // A reaction was resolved — fire any new visual events, then render
  const newEvents = (state.visualEvents || []).filter(function(ev) { return !local.seenVisualEventIds.has(ev.id); });

  // Render board first so HP bars are up to date with previous animations
  render();
  await sleep(120);

  for (let i = 0; i < newEvents.length; i++) {
    const ev = newEvents[i];
    local.seenVisualEventIds.add(ev.id);
    
    // Apply changes to visual state before firing effect
    applyEventToVisualState(ev, state);
    local.completedVisualEventIds.add(ev.id);
    render();
    await sleep(50);
    
    fireVisualEffect(ev);
    await sleep(380);
  }

  if (newEvents.length > 0) await sleep(400);
  render();
}

async function showIntentionReveal(intention) {
  if (!intention) return;
  const overlay = showOverlay();
  const modal = document.createElement("div");
  modal.className = "room-reveal-modal enter";

  // Build the detail rows (only show sections that exist)
  let detailRows = "";
  if (intention.presagioText) {
    detailRows +=
      "<div style=\"background:rgba(217,119,6,0.18);border-left:3px solid #d97706;padding:10px 14px;border-radius:8px;\">" +
        "<strong style=\"color:#f6bd5f;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:4px;\">⚡ Presságio</strong>" +
        "<p style=\"color:#ffe3b3;font-size:0.9rem;margin:0;font-weight:800;\">" + escapeHtml(intention.presagioText) + "</p>" +
      "</div>";
  }
  if (intention.commonText) {
    detailRows +=
      "<div style=\"background:rgba(37,99,235,0.14);border-left:3px solid #2563eb;padding:10px 14px;border-radius:8px;\">" +
        "<strong style=\"color:#93c5fd;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:4px;\">👤 Comuns Atacam</strong>" +
        "<p style=\"color:#dbeafe;font-size:0.9rem;margin:0;font-weight:800;\">" + escapeHtml(intention.commonText) + "</p>" +
      "</div>";
  }
  if (intention.brutalText) {
    detailRows +=
      "<div style=\"background:rgba(220,38,38,0.14);border-left:3px solid #dc2626;padding:10px 14px;border-radius:8px;\">" +
        "<strong style=\"color:#fca5a5;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;display:block;margin-bottom:4px;\">👹 Brutais Atacam</strong>" +
        "<p style=\"color:#fee2e2;font-size:0.9rem;margin:0;font-weight:800;\">" + escapeHtml(intention.brutalText) + "</p>" +
      "</div>";
  }

  modal.innerHTML =
    "<div class=\"room-reveal-card intention-reveal-card\">" +
      "<span class=\"room-reveal-label\">✨ Nova Carta de Intenção</span>" +
      "<h2 class=\"room-reveal-name\" style=\"font-size:clamp(1.4rem,3.5vw,2.4rem);\">" + escapeHtml(intention.name) + "</h2>" +
      (detailRows ? "<div style=\"display:grid;gap:10px;margin-top:14px;text-align:left;\">" + detailRows + "</div>" : "") +
    "</div>";

  overlay.appendChild(modal);
  await sleep(4200);
  modal.classList.remove("enter");
  modal.classList.add("exit");
  await sleep(400);
  await hideOverlay();
}


async function queueCinematicHeroTurn(state) {
  const round = state.round || 1;
  ingestVisualEvents(state);
  render();
  await sleep(300);
  // Banner: hero turn
  await showCinematicBanner("Turno " + round + " dos Heróis", "É a vez dos heróis agirem!", "hero-turn");
  // Reveal the new intention card that was just drawn for this round
  if (state.activeIntention) {
    await showIntentionReveal(state.activeIntention);
  }
  render();
}

function getMe() {
  return local.state?.players.find((player) => player.id === local.playerId);
}

function aliveEnemies() {
  return local.state?.enemies.filter((enemy) => enemy.life > 0) || [];
}

function renderHome() {
  app.innerHTML = `
    <section class="home game-home">
      <div class="home-copy">
        <span class="eyebrow">Prototype arena</span>
        <h1>TCG Cooperativo</h1>
        <p>Uma mesa online com juiz no servidor, cartas com arte, dungeons mutaveis e combate compartilhado.</p>
        <div class="rules-strip">
          <span class="pill">5 cartas por rodada</span>
          <span class="pill">Dano automatico</span>
          <span class="pill">Energia validada</span>
          <span class="pill">Ate 5 jogadores</span>
        </div>
      </div>

      <div class="home-card-preview">
        <article class="tcg-card showcase-card">
          <div class="card-cost">1</div>
          <img src="${cardArt}" alt="" />
          <div class="card-body">
            <strong>Guardia do Vale</strong>
            <span>Heroi de teste</span>
          </div>
        </article>
      </div>

      <div class="join-panel">
        <h2>Entrar na mesa</h2>
        <label>
          Nome
          <input id="name" autocomplete="name" maxlength="24" placeholder="Seu nome" value="${escapeHtml(local.playerName)}" />
        </label>
        <button id="create">Criar sala</button>
        <label>
          Codigo da sala
          <input id="sessionCode" maxlength="5" placeholder="ABCDE" />
        </label>
        <button id="join" class="secondary">Entrar em sala</button>
        <p class="notice">${escapeHtml(local.error)}</p>
      </div>
    </section>
  `;

  const nameInput = document.querySelector("#name");
  const codeInput = document.querySelector("#sessionCode");

  nameInput.addEventListener("input", () => {
    local.playerName = nameInput.value;
    window.localStorage.setItem("tcg.playerName", local.playerName);
  });

  document.querySelector("#create").addEventListener("click", async () => {
    try {
      local.error = "";
      const auth = await api("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ name: nameInput.value })
      });
      saveAuth(auth);
      connectEvents();
      render();
    } catch (error) {
      local.error = error.message;
      render();
    }
  });

  document.querySelector("#join").addEventListener("click", async () => {
    try {
      local.error = "";
      const code = codeInput.value.trim().toUpperCase();
      const auth = await api(`/api/sessions/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ name: nameInput.value })
      });
      saveAuth(auth);
      connectEvents();
      render();
    } catch (error) {
      local.error = error.message;
      render();
    }
  });
}

function renderLobby() {
  const state = local.state;
  const me = getMe();
  const readyToStart = state.players.length > 0 && state.players.every((player) => player.heroId && player.ready);

  app.innerHTML = `
    <section class="lobby-screen">
      ${renderTopbar()}
      <div class="lobby-stage">
        <aside class="lobby-roster glass-panel">
          <div>
            <span class="eyebrow">Sala</span>
            <h2>${state.id}</h2>
          </div>
          <div class="player-list">
            ${state.players.map(renderPlayerHud).join("")}
          </div>
          <div class="toolbar">
            <button id="ready" ${!me?.heroId ? "disabled" : ""}>${me?.ready ? "Nao pronto" : "Pronto"}</button>
            <button id="start" class="secondary" ${readyToStart ? "" : "disabled"}>Comecar</button>
          </div>
          <p class="notice">${escapeHtml(local.error)}</p>
        </aside>

        <section class="hero-select glass-panel">
          <div>
            <span class="eyebrow">Decks iniciais</span>
            <h2>Escolha seu heroi</h2>
          </div>
          <div class="hero-grid">
            ${state.heroes.map((hero) => renderHeroCard(hero, me?.heroId === hero.id)).join("")}
          </div>
        </section>
      </div>
    </section>
  `;

  document.querySelector("#ready").addEventListener("click", () => action({ type: "ready", ready: !me.ready }));
  document.querySelector("#start").addEventListener("click", () => action({ type: "start" }));
  document.querySelectorAll("[data-hero]").forEach((button) => {
    button.addEventListener("click", () => action({ type: "chooseHero", heroId: button.dataset.hero }));
  });
}

function renderGame() {
  const state = local.state;
  const me = getMe();
  const roomTheme = state.room?.theme || "forest";
  const recentLogs = state.log ? state.log.slice(0, 3) : [];
  const recentActionsHtml = recentLogs.length
    ? recentLogs.map((log) => `
      <div class="recent-action-item">
        <span class="action-bullet"></span>
        <span class="action-text">${escapeHtml(log)}</span>
      </div>
    `).join("")
    : `<div class="recent-action-item muted">Nenhuma ação registrada ainda.</div>`;

  let bossHudHtml = "";
  if (state.room?.effect === "bossRoom" && state.enemies.some(e => e.isBoss)) {
    const boss = state.enemies.find(e => e.isBoss);
    bossHudHtml = `
      <div class="boss-hud-bar glass-panel animate-fade-in">
        <div class="boss-hud-info">
          <span class="boss-hud-name">${escapeHtml(boss.name)}</span>
          <span class="badge badge-danger">${boss.fase_atual === 2 ? "Fase 2 - FÚRIA" : "Fase 1"}</span>
        </div>
        ${state.maldicao_contador !== null ? `
          <div class="boss-hud-clock">
            <span class="clock-icon">⌛</span>
            <span class="clock-label">Relógio da Maldição:</span>
            <strong class="clock-value ${state.maldicao_contador <= 2 ? "warning animate-pulse" : ""}">${state.maldicao_contador}</strong>
          </div>
        ` : ""}
        ${state.activeTorment ? `
          <div class="boss-hud-torment">
            <span class="torment-badge">Tormento:</span>
            <span class="torment-name" title="${escapeHtml(state.activeTorment.text)}">${escapeHtml(state.activeTorment.name)}</span>
          </div>
        ` : ""}
      </div>
    `;
  }

  app.innerHTML = `
    <section class="game-board room-${roomTheme}">
      <div class="board-grid">
        <aside class="left-rail">
          <div class="glass-panel hero-party-panel">
            <span class="eyebrow">Jogadores</span>
            <div class="player-list">
              ${state.players.map(renderPlayerHud).join("")}
            </div>
          </div>
        </aside>

        <section class="battlefield">
          ${bossHudHtml}
          <div class="recent-actions-panel glass-panel">
            <div class="recent-actions-header">
              <span class="eyebrow">Ações Recentes</span>
            </div>
            <div class="recent-actions-list">
              ${recentActionsHtml}
            </div>
          </div>

          <div class="monster-row">
            ${state.enemies.map(renderMonsterCard).join("")}
          </div>

          <div class="arena-zone">
            <div class="arena-label">
              <span class="eyebrow">Arena</span>
              <strong>Cartas resolvidas</strong>
            </div>
            <div class="arena-cards">
              ${state.arena.length ? state.arena.map(renderArenaCard).join("") : renderEmptyArena()}
            </div>
          </div>
        </section>

        <aside class="right-rail">
          ${renderTrapCard(state.activeTrap, state.activeTrapDisabledRounds)}
          ${renderTerrainCard(state.terreno_ativo)}
          <div class="glass-panel compact-panel">
            ${renderTurnControls(state, me)}
            <p class="notice">${escapeHtml(local.error)}</p>
          </div>
          ${renderGameStatusPanel(state, me)}
          ${renderSummaryCard(state)}
          ${renderRoomCard(state)}
          ${state.activeTorment ? renderTormentCard(state.activeTorment) : ""}
          ${renderIntentionCard(state.activeIntention)}

          <div class="glass-panel compact-panel">
            <span class="eyebrow">Historico</span>
            <div class="log">
              ${state.log.map((entry) => `<div class="log-entry">${escapeHtml(entry)}</div>`).join("")}
            </div>
          </div>
        </aside>
      </div>
      ${renderHandDock(me, state)}
      ${renderSelectedCardModal(state, me)}
      ${renderReactionPrompt(state, me)}
      ${renderPendingDiscardModal(state, me)}
      ${renderPendingReciclagemModal(state, me)}
      ${renderShieldAllocationModal(state, me)}
      ${renderEnergyAllocationModal(state, me)}
      ${renderEcoArcanoModal(state, me)}
      ${renderDistorcaoTemporalModal(state, me)}
      ${renderRewardSelectionModal(state, me)}
      ${renderIntentionLookModal(state, me)}
      ${renderEspelhoArcanoModal(state, me)}
      ${renderAmplificarModal(state, me)}
      ${renderCataclismoArcanoModal(state, me)}
      ${renderTempestadeEletricaModal(state, me)}
    </section>
  `;

  document.querySelector("#endTurn")?.addEventListener("click", () => action({ type: "endTurn" }));
  document.querySelector("#startNextRound")?.addEventListener("click", () => action({ type: "startNextRound" }));
  document.querySelectorAll("[data-hand-card]").forEach((card) => {
    const openCard = () => {
      local.selectedCardUid = card.dataset.handCard;
      render();
    };
    card.addEventListener("click", openCard);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCard();
      }
    });
  });
  document.querySelector("#closeCardDetail")?.addEventListener("click", () => {
    local.selectedCardUid = "";
    render();
  });
  document.querySelector(".card-lightbox")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("card-lightbox")) {
      local.selectedCardUid = "";
      render();
    }
  });
  document.querySelector("#playSelectedCard")?.addEventListener("click", playSelectedCard);
  document.querySelector("#skipReaction")?.addEventListener("click", () => action({ type: "skipReaction" }));
  document.querySelector("#skipReactionsThisRound")?.addEventListener("click", () => action({ type: "skipReactionsThisRound" }));
  document.querySelectorAll("[data-reaction-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const cardUid = button.dataset.reactionCard;
      const targetSelect = document.querySelector(`#reactionTarget-${cardUid}`);
      const targetId = targetSelect ? targetSelect.value : undefined;
      action({ type: "playReaction", cardUid, targetId });
    });
  });
  document.querySelector("#useSupreme")?.addEventListener("click", () => {
    const me = getMe();
    if (me && me.heroId === "batedor" && me.supremeCard) {
      local.selectedCardUid = me.supremeCard.uid;
      render();
    } else {
      action({ type: "useSupreme" });
    }
  });
  document.querySelector("#buyCard")?.addEventListener("click", () => action({ type: "buyCard" }));
  // pending discard: clicking a card in discard-mode selects it for discard
  document.querySelectorAll("[data-discard-card]").forEach((el) => {
    el.addEventListener("click", () => action({ type: "discardCard", cardUid: el.dataset.discardCard }));
  });
  // reciclagem: click to swap/discard card or finish
  document.querySelectorAll("[data-rec-discard-card]").forEach((el) => {
    el.addEventListener("click", () => action({ type: "reciclagemDiscard", cardUid: el.dataset.recDiscardCard }));
  });
  document.querySelector("#finishReciclagem")?.addEventListener("click", () => {
    action({ type: "finishReciclagem" });
  });
  // shield allocation confirm
  document.querySelector("#confirmShieldAlloc")?.addEventListener("click", () => {
    const allocation = {};
    document.querySelectorAll(".shield-alloc-input").forEach((input) => {
      allocation[input.dataset.pid] = Number(input.value) || 0;
    });
    action({ type: "confirmShieldAllocation", allocation });
  });

  // claim reward click: opens modal
  document.querySelector("#claimRewardBtn")?.addEventListener("click", () => {
    local.rewardModalOpen = true;
    local.selectedRewardId = null;
    render();
  });

  // reward card choice click
  document.querySelectorAll(".reward-card-choice").forEach((card) => {
    if (!card.classList.contains("reward-disabled")) {
      card.addEventListener("click", () => {
        local.selectedRewardId = card.dataset.rewardId;
        render();
      });
    }
  });

  // confirm reward click
  document.querySelector("#confirmRewardBtn")?.addEventListener("click", () => {
    action({ type: "selectRoomReward", rewardId: local.selectedRewardId });
    local.rewardModalOpen = false;
    local.selectedRewardId = null;
  });

  document.querySelector("#confirmIntentionLookBtn")?.addEventListener("click", () => {
    action({
      type: "confirmIntentionLook",
      discardedCardId: local.tempDiscardedId,
      reorderedCardIds: local.tempIntentionOrder
    });
    local.tempIntentionOrder = null;
    local.tempDiscardedId = null;
  });

  // use redraw click
  document.querySelector("#useRedraw")?.addEventListener("click", () => {
    action({ type: "useRedraw" });
  });
}

function setupHandCarousel() {
  const hand = document.querySelector(".hand");
  if (!hand) return;

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId = null;

  hand.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if (event.target.closest("button, select, input, a")) return;

    activePointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = hand.scrollLeft;
    hand.classList.add("is-dragging");
    hand.setPointerCapture(event.pointerId);
  });

  hand.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    hand.scrollLeft = startScrollLeft - (event.clientX - startX);
  });

  const stopDragging = (event) => {
    if (event.pointerId !== activePointerId) return;
    if (hand.hasPointerCapture(event.pointerId)) {
      hand.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    hand.classList.remove("is-dragging");
  };

  hand.addEventListener("pointerup", stopDragging);
  hand.addEventListener("pointercancel", stopDragging);
  hand.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const card = hand.querySelector(".play-card");
    const distance = (card?.getBoundingClientRect().width || 224) + 12;
    hand.scrollBy({ left: direction * distance, behavior: "smooth" });
  });
}

function playSelectedCard() {
  const me = getMe();
  let card = me?.hand.find((candidate) => candidate.uid === local.selectedCardUid);
  let isSupreme = false;
  if (!card && me && me.supremeCard && me.supremeCard.uid === local.selectedCardUid) {
    card = me.supremeCard;
    isSupreme = true;
  }
  if (!card) {
    showToast("Carta nao encontrada.");
    return;
  }
  if (local.state.turn !== "players") {
    showToast("Agora e o turno da dungeon.");
    return;
  }
  if (local.state.pendingReaction) {
    showToast("Resolva a janela de reacao primeiro.");
    return;
  }
  if (card.type === "reaction") {
    showToast("Cartas de reacao so podem ser usadas na janela da dungeon.");
    return;
  }
  if (me.turnEnded) {
    showToast("Voce ja finalizou seu turno.");
    return;
  }
  if (!isSupreme && me.energy < card.cost) {
    showToast("Energia insuficiente.");
    return;
  }
  if (card.lifeCost && me.life <= card.lifeCost) {
    showToast("Vida insuficiente.");
    return;
  }
  const button = document.querySelector("#playSelectedCard");
  button.disabled = true;
  window.setTimeout(() => {
    const target = document.querySelector("#selectedCardTarget");
    const fromTarget = document.querySelector("#selectedCardFrom");
    const amountInput = document.querySelector("#shieldMoveAmount");
    if (isSupreme) {
      action({
        type: "useSupreme",
        targetId: target?.value
      });
      local.selectedCardUid = null;
    } else {
      action({
        type: "playCard",
        cardUid: card.uid,
        targetId: target?.value,
        fromId: fromTarget?.value,
        shieldAmount: amountInput ? Number(amountInput.value) : undefined
      });
    }
  }, 120);
}

function renderReactionPrompt(state, me) {
  if (local.animRunning) return "";
  const pending = state.pendingReaction;
  if (!pending) return "";

  const isEligible = pending.eligiblePlayerIds.includes(me.id) && !pending.skippedPlayerIds.includes(me.id);
  const reactionCards = me.hand.filter((card) => {
    if (card.type !== "reaction") return false;
    if (pending.playableCardUids && pending.playableCardUids[me.id]) {
      return pending.playableCardUids[me.id].includes(card.uid);
    }
    return true;
  });

  const reactionTitle = pending.type === "trap" 
    ? `A Armadilha ${escapeHtml(pending.trapName)} vai aplicar seu efeito`
    : pending.type === "status_apply"
    ? `O status ${escapeHtml(pending.statusType)} vai ser aplicado em ${escapeHtml(pending.targetName)}`
    : pending.type === "cura_emergencia"
    ? `Cura de Emergência: Heróis com pouca Vida!`
    : `${escapeHtml(pending.enemyName)} vai atacar ${escapeHtml(pending.targetName)}`;

  const reactionText = pending.type === "trap" || pending.type === "status_apply" || pending.type === "cura_emergencia"
    ? escapeHtml(pending.ruleText)
    : `${escapeHtml(pending.ruleText)} Dano previsto: ${pending.attack}.`;

  return `
    <section class="reaction-window" role="dialog" aria-modal="true" aria-labelledby="reactionTitle">
      <div class="reaction-panel glass-panel">
        <span class="eyebrow">Janela de reacao</span>
        <h2 id="reactionTitle">${reactionTitle}</h2>
        <p>${reactionText}</p>
        ${
          isEligible
            ? `
              <div class="reaction-cards">
                ${reactionCards
                  .map(
                    (card) => {
                      let cost = card.cost;
                      if (me.proxima_carta_desconto_1) {
                        cost = Math.max(0, cost - 1);
                      }
                      
                      let targetSelectHtml = "";
                      if (card.id === "voz-do-oraculo") {
                        targetSelectHtml = `
                          <label style="margin: 8px 12px; display: block; text-align: left; font-size: 0.85em;">
                            Herói imune:
                            <select id="reactionTarget-${card.uid}" style="width: 100%; padding: 6px; border-radius: 4px; background: #222; color: #fff; border: 1px solid #444; margin-top: 4px;">
                              ${state.players.filter(p => p.life > 0).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
                            </select>
                          </label>
                        `;
                      } else if (card.id === "cura-de-emergencia") {
                        targetSelectHtml = `
                          <label style="margin: 8px 12px; display: block; text-align: left; font-size: 0.85em;">
                            Herói a curar:
                            <select id="reactionTarget-${card.uid}" style="width: 100%; padding: 6px; border-radius: 4px; background: #222; color: #fff; border: 1px solid #444; margin-top: 4px;">
                              ${state.players.filter(p => p.life > 0 && p.life <= 8).map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.life} PV)</option>`).join("")}
                            </select>
                          </label>
                        `;
                      }

                      return `
                        <article class="tcg-card reaction-choice ${me.energy < cost ? "unplayable" : ""}">
                          <div class="card-cost">${cost}</div>
                          <img src="${getCardArt(card)}" alt="" />
                          <div class="card-body">
                            <strong>${escapeHtml(card.name)}</strong>
                            <p style="font-size:0.75rem; line-height: 1.2; margin: 4px 0;">${escapeHtml(card.text)}</p>
                            ${renderCardTags(card)}
                          </div>
                          ${targetSelectHtml}
                          <button data-reaction-card="${card.uid}" ${me.energy < cost ? "disabled" : ""}>Usar reacao</button>
                        </article>
                      `;
                    }
                  )
                  .join("")}
              </div>
              <button id="skipReaction" class="secondary">Nao reagir desta vez</button>
              <button id="skipReactionsThisRound" class="secondary">Nao reagir neste turno</button>
            `
            : `<p class="muted">Aguardando jogadores com cartas de reacao decidirem.</p>`
        }
      </div>
    </section>
  `;
}

function renderIntentionLookModal(state, me) {
  if (local.animRunning) return "";
  const look = state.pendingIntentionLook;
  if (!look) return "";

  const isMe = look.casterId === me.id;

  if (isMe && !local.tempIntentionOrder) {
    local.tempIntentionOrder = look.cards.map(c => c.id);
    local.tempDiscardedId = null;
  }

  if (!isMe) {
    local.tempIntentionOrder = null;
    local.tempDiscardedId = null;
  }

  const cardsList = look.cards;
  const discardedId = local.tempDiscardedId;
  const currentOrder = local.tempIntentionOrder || [];

  let contentHtml = "";
  if (isMe) {
    contentHtml = `
      <p style="margin-bottom: 12px; color: #f2dfb7;">Você pode reorganizar os monstros do topo do baralho. ${look.canDiscard ? "Também pode colocar um monstro no fundo do baralho." : ""}</p>
      
      <div style="display: grid; gap: 12px; margin-bottom: 20px;">
        ${currentOrder.map((id, index) => {
          const card = cardsList.find(c => c.id === id);
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
              <div style="text-align: left;">
                <strong style="color: #fff; font-size: 1.05rem;">${escapeHtml(card.name)}</strong>
                <p style="margin: 4px 0 0 0; font-size: 0.82rem; color: #bbb;">${escapeHtml(card.presagioText)}</p>
              </div>
              <div style="display: flex; gap: 6px;">
                ${index > 0 ? `<button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="moveIntentionUp(${index})">⬆ Subir</button>` : ""}
                ${index < currentOrder.length - 1 ? `<button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="moveIntentionDown(${index})">⬇ Descer</button>` : ""}
                ${look.canDiscard && !discardedId ? `<button class="danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="discardIntention('${card.id}')">🗑 Descartar</button>` : ""}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      ${discardedId ? `
        <div style="margin-bottom: 20px; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
          <div style="text-align: left;">
            <span style="color: #ef4444; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; display: block;">Descartado (irá para o fundo):</span>
            <strong style="color: #fff;">${escapeHtml(cardsList.find(c => c.id === discardedId)?.name)}</strong>
          </div>
          <button class="secondary" style="padding: 4px 8px; font-size: 0.75rem;" onclick="undiscardIntention()">Desfazer descarte</button>
        </div>
      ` : ""}

      <button id="confirmIntentionLookBtn" style="width: 100%; font-weight: 900; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 12px; border-radius: 6px; cursor: pointer;">
        Confirmar Reordenação
      </button>
    `;
  } else {
    contentHtml = `
      <p class="muted" style="text-align: center; padding: 20px;">Niely está olhando e reordenando os Monstros do topo do baralho...</p>
    `;
  }

  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="intentionLookTitle">
      <div class="glass-panel" style="width: min(540px, 100%); padding: 20px; display: grid; gap: 14px; position: relative;">
        <h2 id="intentionLookTitle" style="color: #ffd785; font-size: 1.5rem; margin: 0; text-align: center;">Previsão do Futuro (Monstros)</h2>
        ${contentHtml}
      </div>
    </div>
  `;
}

window.moveIntentionUp = (index) => {
  if (index <= 0) return;
  const temp = local.tempIntentionOrder[index];
  local.tempIntentionOrder[index] = local.tempIntentionOrder[index - 1];
  local.tempIntentionOrder[index - 1] = temp;
  render();
};

window.moveIntentionDown = (index) => {
  if (index >= local.tempIntentionOrder.length - 1) return;
  const temp = local.tempIntentionOrder[index];
  local.tempIntentionOrder[index] = local.tempIntentionOrder[index + 1];
  local.tempIntentionOrder[index + 1] = temp;
  render();
};

window.discardIntention = (cardId) => {
  local.tempDiscardedId = cardId;
  local.tempIntentionOrder = local.tempIntentionOrder.filter(id => id !== cardId);
  render();
};

window.undiscardIntention = () => {
  if (!local.tempDiscardedId) return;
  local.tempIntentionOrder.push(local.tempDiscardedId);
  local.tempDiscardedId = null;
  render();
};

function renderGameStatusPanel(state, me) {
  const isPlayersTurn = state.turn === "players";
  const completed = state.players.filter((player) => player.turnEnded).length;
  const total = state.players.length;
  return `
    <section class="glass-panel game-status-panel ${isPlayersTurn ? "players-turn" : "dungeon-turn"}">
      <div>
        <span class="eyebrow">Mesa ${escapeHtml(local.sessionId)}</span>
        <strong>${isPlayersTurn ? "Turno dos jogadores" : "Turno da dungeon"}</strong>
      </div>
      <div class="status-line">
        <span>${isPlayersTurn ? `${completed}/${total} finalizaram` : "Intencao resolvida"}</span>
        ${me.turnEnded ? "<span>Voce finalizou</span>" : ""}
      </div>
      <div class="topbar-actions">
        <button id="rulesToggle" class="secondary">Regras</button>
        <button id="leave" class="secondary">Sair</button>
      </div>
    </section>
  `;
}

function renderHandDock(me, state) {
  const hasSupreme = me.supremeCard && !me.supremeUsed;
  return `
    <section class="hand-dock" aria-label="Mao do jogador">
      <div class="hand-meta glass-panel">
        <button id="buyCard" class="buy-card-btn" title="Comprar carta (1⚡)" ${state.turn !== 'players' || me.turnEnded || me.energy < 1 || me.hand.length >= (me.maxHandSize || 5) ? 'disabled' : ''}>
          <span class="buy-card-text">+1</span>
          <span class="buy-card-cost">⚡</span>
        </button>
        ${hasSupreme ? `
          <div class="supreme-container">
            <button id="useSupreme" class="supreme-btn" ${state.turn !== 'players' || me.turnEnded ? 'disabled' : ''}>
              Suprema
            </button>
            <div class="supreme-hover-preview">
              <article class="tcg-card play-card ${me.supremeCard.type} supreme-preview-card">
                <div class="card-cost">${me.supremeCard.cost}</div>
                <img src="${getCardArt(me.supremeCard)}" alt="" />
                <div class="card-body">
                  <strong>${escapeHtml(me.supremeCard.name)}</strong>
                  <p>${escapeHtml(me.supremeCard.text)}</p>
                  ${renderCardTags(me.supremeCard)}
                </div>
              </article>
            </div>
          </div>
        ` : me.supremeUsed ? `<span class="supreme-used muted">Suprema usada</span>` : ""}
        ${me.hasRedrawAvailable ? `
          <div class="supreme-container">
            <button id="useRedraw" class="supreme-btn" ${state.turn !== 'players' || me.turnEnded ? 'disabled' : ''} style="background: linear-gradient(135deg, #a855f7, #6366f1); box-shadow: 0 0 14px rgba(168, 85, 247, 0.5); color: #fff; animation: none;">
              🔄 Trocar Mão
            </button>
          </div>
        ` : ""}
      </div>
      <div class="hand-fan" role="list" aria-label="Cartas na sua mao">
        ${
          me.hand.length
            ? me.hand.map((card, index) => renderHandCard(card, state, index, me.hand.length)).join("")
            : "<p class=\"muted\">Sem cartas na mao.</p>"
        }
      </div>
    </section>
  `;
}

function renderSelectedCardModal(state, me) {
  if (local.animRunning) return "";
  let card = me.hand.find((candidate) => candidate.uid === local.selectedCardUid);
  if (!card && me.supremeCard && me.supremeCard.uid === local.selectedCardUid) {
    card = me.supremeCard;
  }
  if (!card) return "";

  const canTargetMonster = ((card.type === "attack" && !card.areaDamage) || card.target === "enemy" || card.enemyChallenge) && card.id !== "companheiro-animal";
  const needsReviveTarget = Boolean(card.revive);
  const canTargetDefeated = needsReviveTarget;
  const canTargetPlayer = (card.type === "heal" && !card.allHeal && !card.revive) || card.target === "ally" || card.provoke || (card.planning && card.target === "ally");
  const needsMoveShield = Boolean(card.moveShield);

  let targetSelect = "";
  if (canTargetMonster) {
    targetSelect = `<label>Alvo
      <select id="selectedCardTarget">
        ${state.enemies.filter((e) => e.life > 0).map((e) => `<option value="${e.uid}">${escapeHtml(e.name)}</option>`).join("")}
      </select></label>`;
  } else if (canTargetDefeated) {
    targetSelect = `<label>Aliado derrotado
      <select id="selectedCardTarget">
        ${state.players.filter((p) => p.life <= 0).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select></label>`;
  } else if (canTargetPlayer) {
    targetSelect = `<label>Alvo
      <select id="selectedCardTarget">
        ${state.players.filter((p) => p.life > 0).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
      </select></label>`;
  }

  let moveShieldControls = "";
  if (needsMoveShield) {
    moveShieldControls = `
      <label>Mover escudo de
        <select id="selectedCardFrom">
          ${state.players.filter((p) => p.life > 0 && p.shield > 0).map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.shield} esc.)</option>`).join("")}
        </select>
      </label>
      <label>Para
        <select id="selectedCardTarget">
          ${state.players.filter((p) => p.life > 0).map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("")}
        </select>
      </label>
      <label>Quantidade <input id="shieldMoveAmount" type="number" min="1" max="99" value="1" style="width:70px" /></label>
    `;
    targetSelect = "";
  }

  const blocked = isCardBlocked(card, state, me) || card.type === "reaction";

  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="selectedCardName">
      <article class="tcg-card selected-card-detail ${card.type}">
        <button id="closeCardDetail" class="card-close secondary" aria-label="Fechar carta">Fechar</button>
        <div class="card-cost" ${card.lifeCost ? 'style="background: #ef4444; border-color: #ef4444; color: white;"' : ''}>${card.lifeCost ? `${card.lifeCost}❤️` : card.cost}</div>
        <img src="${getCardArt(card)}" alt="" />
        <div class="card-body">
          <strong id="selectedCardName">${escapeHtml(card.name)}</strong>
          <p>${escapeHtml(card.text)}</p>
          ${renderCardTags(card)}
        </div>
        ${targetSelect}
        ${moveShieldControls}
        <button id="playSelectedCard" ${blocked ? "disabled" : ""}>Jogar</button>
      </article>
    </div>
  `;
}

function renderTurnBanner(state, me) {
  const isPlayersTurn = state.turn === "players";
  const completed = state.players.filter((player) => player.turnEnded).length;
  const total = state.players.length;
  return `
    <div class="turn-banner ${isPlayersTurn ? "players-turn" : "dungeon-turn"}">
      <div>
        <span class="eyebrow">Turno atual</span>
        <strong>${isPlayersTurn ? "Jogadores" : "Dungeon"}</strong>
      </div>
      <div class="turn-status">
        ${isPlayersTurn ? `${completed}/${total} jogadores finalizaram` : "A intencao foi resolvida"}
        ${me.turnEnded ? "<span>Voce finalizou</span>" : ""}
      </div>
    </div>
  `;
}

function renderTurnControls(state, me) {
  if (state.pendingReaction) {
    return ``;
  }

  if (state.turn === "players") {
    return `
      <button id="endTurn" class="danger" ${me.turnEnded ? "disabled" : ""}>
        ${me.turnEnded ? "Turno finalizado" : "Finalizar turno"}
      </button>
    `;
  }

  if (state.roomComplete) {
    if (!me.hasClaimedRoomReward) {
      return `
        <button id="claimRewardBtn" style="background: linear-gradient(135deg, #ffd785, #a8720a); color: #1a1000; font-weight: 900; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; box-shadow: 0 0 15px rgba(245, 194, 0, 0.4);">
          🎁 Receber Recompensas
        </button>
      `;
    }
    if (!state.allRewardsClaimed) {
      return `
        <button disabled class="secondary" style="opacity: 0.6; cursor: not-allowed;">Aguardando Grupo...</button>
      `;
    }
  }

  return `
    <button id="startNextRound">${state.roomComplete ? "Avancar para proxima sala" : "Iniciar proxima rodada"}</button>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar game-topbar">
      <div class="brand">
        <span class="eyebrow">Online cooperative TCG</span>
        <h1>Arena Cooperativa</h1>
        <p>Sala ${escapeHtml(local.sessionId)} | combates, custos e dano validados pelo servidor</p>
      </div>
      <div class="topbar-actions">
        <button id="rulesToggle" class="secondary">Regras</button>
        <button id="leave" class="secondary">Sair</button>
      </div>
    </header>
  `;
}

function renderRoomCard(state) {
  const room = state.room;
  return `
    <article class="room-card glass-panel">
      <span class="eyebrow">Sala ${state.roomNumber || 1} | Rodada ${state.roomRound}</span>
      <h2>${escapeHtml(room?.name || "Sala desconhecida")}</h2>
      <p>${escapeHtml(room?.subtitle || "")}</p>
      <div class="room-objective">${escapeHtml(room?.objective || "Derrote todos os inimigos.")}</div>
      <div class="room-rule">${escapeHtml(room?.rule || "")}</div>
      <div class="room-reward">${escapeHtml(room?.reward || "")}</div>
    </article>
  `;
}

function renderTormentCard(torment) {
  if (!torment) return "";
  return `
    <article class="torment-card glass-panel">
      <span class="eyebrow">Tormento Ativo</span>
      <div class="torment-header">
        <span class="card-number">${escapeHtml(torment.id)}</span>
        <h2>${escapeHtml(torment.name)}</h2>
      </div>
      <p class="torment-text">${escapeHtml(torment.text)}</p>
    </article>
  `;
}

function renderTrapCard(trap, disabledRounds) {
  if (!trap) {
    return `
      <article class="trap-card glass-panel">
        <span class="eyebrow">Armadilha</span>
        <div class="trap-art"><img src="${trapArts[0]}" alt="" /></div>
        <h2>Aguardando armadilha</h2>
      </article>
    `;
  }

  const isDisabled = disabledRounds && disabledRounds > 0;
  return `
    <article class="trap-card glass-panel ${isDisabled ? 'trap-disabled' : ''}">
      <span class="eyebrow">${isDisabled ? `Desativada (${disabledRounds} rod.)` : 'Armadilha ativa'}</span>
      <div class="trap-art"><img src="${getTrapArt(trap)}" alt="" /><span>${escapeHtml(trap.id)}</span></div>
      <h2>${escapeHtml(trap.name)}</h2>
      <p>${escapeHtml(trap.text)}</p>
    </article>
  `;
}

function renderTerrainCard(terrain) {
  if (!terrain) {
    return `
      <article class="glass-panel active-terrain-card" style="padding: 12px; margin-bottom: 12px; border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.15);">
        <span class="eyebrow" style="color: #a197b0; font-weight: bold; font-size: 0.8em; text-transform: uppercase;">Terreno Ativo</span>
        <p style="margin: 6px 0 0 0; font-size: 0.95em; opacity: 0.6; font-style: italic; color: #ccc;">vazio</p>
      </article>
    `;
  }
  let name = "";
  let text = "";
  let color = "";
  if (terrain === "CHAO_DE_GELO") {
    name = "Terreno: Chao de Gelo";
    text = "❄️ Todos os ataques inimigos causam 1 de dano a menos (mínimo 1). Persiste até o fim da sala.";
    color = "#3b82f6";
  } else if (terrain === "VORTICE_ARCANO") {
    name = "Terreno: Vortice Arcano";
    text = "🌀 Todos os heróis recuperam 1 de Energia adicional no início da rodada. Persiste até o fim da sala.";
    color = "#a855f7";
  } else if (terrain === "TERRENO_ARCANO") {
    name = "Terreno Arcano";
    text = "🌀 Enquanto este terreno estiver ativo, todos os aliados ganham +1 de Energia máxima.";
    color = "#d946ef";
  } else if (terrain === "TERRENO_MONTANHOSO") {
    name = "Terreno Montanhoso";
    text = "⛰️ Enquanto este terreno estiver ativo, todos os inimigos causam 2 a menos de dano.";
    color = "#eab308";
  } else if (terrain === "TERRENO_COSMICO") {
    name = "Terreno Cósmico";
    text = "🌌 Enquanto ativo, todos os heróis aumentam o limite máximo de cartas na mão em +1.";
    color = "#06b6d4";
  }
  
  return `
    <article class="glass-panel active-terrain-card" style="border-left: 4px solid ${color}; padding: 12px; margin-bottom: 12px; border-radius: 8px;">
      <span class="eyebrow" style="color: ${color}; font-weight: bold; font-size: 0.8em; text-transform: uppercase;">Terreno Ativo</span>
      <h3 style="margin: 4px 0; font-size: 1.1em; color: var(--color-text);">${escapeHtml(name)}</h3>
      <p style="margin: 4px 0 0 0; font-size: 0.9em; opacity: 0.9; line-height: 1.3;">${escapeHtml(text)}</p>
    </article>
  `;
}

function getTrapArt(trap) {
  const number = Number(String(trap?.id || "").replace(/\D/g, ""));
  return trapArts[number % trapArts.length];
}

function renderIntentionCard(intention) {
  return "";
}

function renderSummaryCard(state) {
  const roomRule = state.room?.rule ? state.room.rule : "Nenhuma regra especial ativa.";

  let trapText = "Sem armadilha ativa.";
  if (state.activeTrap) {
    const isTrapDisabled = state.activeTrapDisabledRounds && state.activeTrapDisabledRounds > 0;
    if (isTrapDisabled) {
      trapText = `<strong>${escapeHtml(state.activeTrap.name)} (Desativada por ${state.activeTrapDisabledRounds} rod.):</strong> ${escapeHtml(state.activeTrap.text)}`;
    } else {
      trapText = `<strong>${escapeHtml(state.activeTrap.name)}:</strong> ${escapeHtml(state.activeTrap.text)}`;
    }
  }

  const roomNum = state.roomNumber || 1;
  const progressText = roomNum === 9
    ? "Confronte o Chefe na Câmara Final!"
    : `Sala ${roomNum} de 8 para chegar ao Chefe.`;

  return `
    <article class="summary-card glass-panel">
      <span class="eyebrow">Resumo do Combate</span>
      
      <div class="summary-section summary-intention">
        <h3>Mecânica da Masmorra</h3>
        <div class="summary-content">
          <p style="color: #ffd785; font-weight: bold; margin: 0 0 6px 0;">⚔️ Combate em Área</p>
          <p style="margin: 0; font-size: 0.88em; line-height: 1.4; color: #ccc;">No turno da masmorra, cada monstro ataca todos os heróis vivos ao mesmo tempo. Habilidades de Provocar forçam o monstro a atingir apenas o provocador.</p>
        </div>
      </div>

      <div class="summary-section summary-trap">
        <h3>Armadilha Ativa</h3>
        <div class="summary-content">${trapText}</div>
      </div>

      <div class="summary-section summary-room">
        <h3>Progresso</h3>
        <div class="summary-content" style="color: #60a5fa; font-weight: bold;">${escapeHtml(progressText)}</div>
      </div>
    </article>
  `;
}

function renderStatusEffects(statusEffects) {
  if (!statusEffects) return "";
  const badges = [];
  if (statusEffects.veneno > 0) {
    badges.push(`<span class="status-badge veneno" title="Veneno: sofre ${statusEffects.veneno} de dano no início da rodada. Curável.">🧪 Veneno ${statusEffects.veneno}</span>`);
  }
  if (statusEffects.queimadura && statusEffects.queimadura.duration > 0) {
    badges.push(`<span class="status-badge queimadura" title="Queimadura: sofre ${statusEffects.queimadura.value} de dano (ignora Escudo) no final do turno da masmorra. Duração: ${statusEffects.queimadura.duration} rodadas.">🔥 Queimadura ${statusEffects.queimadura.value} (${statusEffects.queimadura.duration}r)</span>`);
  }
  if (statusEffects.vacuo) {
    badges.push(`<span class="status-badge vacuo" title="Vácuo: não recebe compra automática no início da rodada.">🌀 Vácuo</span>`);
  }
  if (statusEffects.enfraquecido > 0) {
    badges.push(`<span class="status-badge enfraquecido" title="Enfraquecido: a próxima carta de ataque causará ${statusEffects.enfraquecido} a menos de dano.">⚔️ Enfraquecido ${statusEffects.enfraquecido}</span>`);
  }
  if (statusEffects.exposto) {
    badges.push(`<span class="status-badge exposto" title="Exposto: sofre +1 de dano de todas as fontes.">🎯 Exposto</span>`);
  }
  if (statusEffects.marcado) {
    badges.push(`<span class="status-badge marcado" title="Marcado: sofre efeitos adicionais de certas habilidades.">🎯 Marcado</span>`);
  }
  if (statusEffects.envenenamento > 0) {
    badges.push(`<span class="status-badge envenenamento" title="Envenenamento: sofre ${statusEffects.envenenamento} de dano (ignora Escudo) no início da Fase da Masmorra.">🧪 Envenenamento ${statusEffects.envenenamento}</span>`);
  }
  if (badges.length === 0) return "";
  return `<div class="status-effects-list">${badges.join("")}</div>`;
}

function renderEnemyStatusEffects(enemy) {
  const badges = [];
  const se = enemy.statusEffects;
  if (se) {
    if (se.veneno > 0) {
      badges.push(`<span class="status-badge veneno" title="Veneno: sofre ${se.veneno} de dano no início da rodada. Curável.">🧪 Veneno ${se.veneno}</span>`);
    }
    if (se.vacuo) {
      badges.push(`<span class="status-badge vacuo" title="Vácuo: não recebe compra automática no início da rodada.">🌀 Vácuo</span>`);
    }
    if (se.enfraquecido > 0) {
      badges.push(`<span class="status-badge enfraquecido" title="Enfraquecido: a próxima carta de ataque causará ${se.enfraquecido} a menos de dano.">⚔️ Enfraquecido ${se.enfraquecido}</span>`);
    }
    if (se.exposto) {
      badges.push(`<span class="status-badge exposto" title="Exposto: sofre +1 de dano de todas as fontes.">🎯 Exposto</span>`);
    }
    if (se.marcado) {
      badges.push(`<span class="status-badge marcado" title="Marcado: sofre efeitos adicionais de certas habilidades.">🎯 Marcado</span>`);
    }
    if (se.envenenamento > 0) {
      badges.push(`<span class="status-badge envenenamento" title="Envenenamento: sofre ${se.envenenamento} de dano (ignora Escudo) no início da Fase da Masmorra.">🧪 Envenenamento ${se.envenenamento}</span>`);
    }
  }

  if (enemy.marcas_arcanas > 0) {
    badges.push(`<span class="status-badge marca-arcana" style="background: linear-gradient(135deg, #ec4899, #db2777); color: white;" title="Marcas Arcanas: sofre 3 de dano (ignora escudo) por marca ao usar Detonação Arcana.">✨ Marcas: ${enemy.marcas_arcanas}/5</span>`);
  }
  if (enemy.queimadura_rodadas > 0) {
    badges.push(`<span class="status-badge queimadura" style="background: linear-gradient(135deg, #f97316, #ea580c); color: white;" title="Queimadura: sofre ${enemy.queimadura} de dano (ignora Escudo) no final do turno da masmorra. Duração: ${enemy.queimadura_rodadas} rodadas.">🔥 Queimadura ${enemy.queimadura} (${enemy.queimadura_rodadas}r)</span>`);
  }
  if (enemy.reduzir_ofensiva > 0) {
    badges.push(`<span class="status-badge reduzir-ofensiva" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white;" title="Reduzir Ofensiva: ataca por último e causa -${enemy.reduzir_ofensiva} de dano nesta rodada (mínimo 1).">🛑 Reduzir Ofensiva ${enemy.reduzir_ofensiva}</span>`);
  }
  if (enemy.reducao_proximo_ataque > 0) {
    badges.push(`<span class="status-badge reducao-proximo" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;" title="Redução Próximo Ataque: causa -${enemy.reducao_proximo_ataque} de dano em seu próximo ataque esta rodada (mínimo 1).">❄️ Prox. Ataque -${enemy.reducao_proximo_ataque}</span>`);
  }

  const activeKeywords = enemy.keywords?.filter(kw =>
    ["Peçonhenta", "Paralisante", "Sanguinária", "Curandeira", "Guardiã", "Explodir", "Invocar"].includes(kw) &&
    enemy[`keyword_${kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}_suprimida_rodada`]
  );
  if (activeKeywords && activeKeywords.length > 0) {
    badges.push(`<span class="status-badge keyword-suprimida" style="background: #4b5563; color: white;" title="Keywords Suprimidas: as habilidades especiais deste monstro estão anuladas esta rodada.">🚫 Suprimido</span>`);
  }

  if (badges.length === 0) return "";
  return `<div class="status-effects-list">${badges.join("")}</div>`;
}

function renderPlayerHud(player) {
  const hasResources = (local.state?.status === "playing" || local.animRunning) && Number.isFinite(player.maxLife) && Number.isFinite(player.maxEnergy);
  return `
    <article id="hud-player-${player.id}" class="player-hud hero-${player.heroId || "none"} ${player.id === local.playerId ? "is-you" : ""} ${player.turnEnded ? "turn-ended" : ""}">
      <div class="portrait">
        <img src="${getHeroCardArt(player.heroId)}" alt="" />
      </div>
      <div class="hud-main">
        <div class="hud-title">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${escapeHtml(player.heroName || "Sem heroi")} ${player.turnEnded ? "| finalizou" : player.ready ? "| pronto" : ""}</span>
        </div>
        ${
          hasResources
            ? `
              ${renderPlayerMeter("life", getVisualLife(player.id, player.life || 0), player.maxLife || 1, "Vida", `hero-${player.id}-life`)}
              ${renderPlayerMeter("energy", player.energy || 0, player.maxEnergy || 1, "Energia", `hero-${player.id}-energy`)}
              ${renderStatusEffects(player.statusEffects)}
              <div class="hud-stats">
                <span class="hero-shield shield-badge"><i></i>${getVisualShield(player.id, player.shield || 0)}</span>
                ${player.profecia_tokens && player.profecia_tokens.length > 0 ? `<span class="hero-profecia prophecy-badge" title="Profecia ativa: cura ao sofrer dano de ataque inimigo.">👁️ Profecia: +${player.profecia_tokens.reduce((a, b) => a + b, 0)}</span>` : ""}
                ${player.proxima_carta_desconto_1 ? `<span class="hero-bencao-arcana discount-badge" title="Bênção Arcana ativa: próxima carta jogada custa 1 a menos.">✨ Bênção</span>` : ""}
                ${player.heroId === "guardiao" && player.carga_de_batalha !== undefined && player.carga_de_batalha !== null ? `<span class="hero-carga-batalha charge-badge" title="Carga de Batalha: acumula ao provocar/proteger e aumenta o dano de Carga do Guardião.">⚔️ Carga: ${player.carga_de_batalha}</span>` : ""}
                ${player.sobrecarga_pendente > 0 ? `<span class="hero-sobrecarga charge-badge" style="background: linear-gradient(135deg, #ec4899, #db2777); color: white;" title="Sobrecarga ativa: reduzirá a energia restaurada na próxima rodada.">⚡ Sobrecarga: ${player.sobrecarga_pendente}</span>` : ""}
                <span>Deck ${player.deckCount}</span>
                <span>Mao ${player.handCount}</span>
                <span>Desc ${player.discardCount}</span>
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderPlayerMeter(kind, value, max, label, key) {
  return `
    <div class="hero-resource ${kind}">
      <div class="hero-resource-top">
        <span>${label}</span>
        <strong>${value}/${max}</strong>
      </div>
      ${renderMeter(kind, value, max, label, key)}
    </div>
  `;
}

function renderHeroCard(hero, selected) {
  return `
    <article class="hero-choice ${selected ? "selected" : ""}">
      <article class="tcg-card hero-preview">
        <div class="card-cost">${hero.energy}</div>
        <img src="${getHeroCardArt(hero.id)}" alt="" />
        <div class="card-body">
          <strong>${escapeHtml(hero.name)}</strong>
          <span>${hero.life} vida | ${hero.energy} energia</span>
        </div>
      </article>
      <button data-hero="${hero.id}" class="${selected ? "secondary" : ""}">${selected ? "Selecionado" : "Escolher"}</button>
    </article>
  `;
}

function renderMonsterCard(enemy) {
  const isHidden = local.roomStartInProgress && !local.revealedEnemyUids.has(enemy.uid);
  const visualLife = getVisualLife(enemy.uid, enemy.life || 0);
  const visualShield = getVisualShield(enemy.uid, enemy.shield || 0);
  const defeated = visualLife <= 0;

  const categoryText = enemy.category === "brutal" ? "Brutal" : "Comum";
  const metaParts = [enemy.role, categoryText];
  if (enemy.keywords && enemy.keywords.length > 0) {
    enemy.keywords.forEach(kw => {
      let text = kw;
      if (kw === "Curandeira") text = `Curandeira ${enemy.curandeiraValue || ""}`;
      if (kw === "Guardiã") text = `Guardiã ${enemy.guardiaValue || ""}`;
      metaParts.push(text);
    });
  }
  const metaText = metaParts.filter(Boolean).join(" • ");

  let targetBadgeHtml = "";
  if (enemy.currentTargetName && !defeated) {
    targetBadgeHtml = `
      <div class="monster-target-badge" title="Alvo atual do monstro para esta rodada">
        Alvo: <span>${escapeHtml(enemy.currentTargetName)}</span>
      </div>
    `;
  }

  const healthPct = Math.max(0, Math.min(100, Math.round((visualLife / enemy.maxLife) * 100)));

  return `
    <article id="card-enemy-${enemy.uid}" class="monster-card ${enemy.category} ${defeated ? "defeated" : ""}" style="${isHidden ? "opacity: 0; pointer-events: none; transition: opacity 0.5s;" : ""}">
      ${targetBadgeHtml}
      
      <div class="monster-art">
        <img src="${getEnemyArt(enemy)}" alt="" />
      </div>

      <!-- Nome Vertical (Borda Esquerda) -->
      <div class="monster-vertical-name">
        ${escapeHtml(enemy.name)}
      </div>

      <!-- Informações Verticais (Borda Direita) -->
      <div class="monster-vertical-meta" title="${escapeHtml(metaText)}">
        ${escapeHtml(metaText)}
      </div>

      <!-- Efeitos de Status (Flutuando no Centro-Baixo) -->
      <div class="monster-status-overlay">
        ${renderEnemyStatusEffects(enemy)}
      </div>

      <!-- Badges de Ataque e Escudo (Canto Inferior Esquerdo) -->
      <div class="monster-badge-left">
        ${visualShield > 0 ? `
          <div class="stat-badge shield" title="Escudo: ${visualShield}">
            <span class="badge-bg">🛡️</span>
            <span class="badge-value">${visualShield}</span>
          </div>
        ` : ""}
        <div class="stat-badge attack" title="Ataque: ${enemy.attack}">
          <span class="badge-bg">⚔️</span>
          <span class="badge-value">${enemy.attack}</span>
        </div>
      </div>

      <!-- Pote de Vida Estilo Diablo (Canto Inferior Direito) -->
      <div class="monster-health-vial" title="Vida: ${visualLife}/${enemy.maxLife}" style="--health-pct: ${healthPct}%;">
        <div class="vial-liquid"></div>
        <div class="vial-glass"></div>
        <span class="vial-value">${visualLife}</span>
      </div>
    </article>
  `;
}

function isCardBlocked(card, state, me) {
  if (!me) return true;
  if (state.turn !== "players" || me.turnEnded || me.energy < card.cost) return true;
  if (card.lifeCost && me.life <= card.lifeCost) return true;

  const alivePlayers = state.players.filter((p) => p.life > 0);
  if (card.id === "manipular-energia" || card.id === "redistribuir-escudos" || card.id === "escudo-compartilhado") {
    if (alivePlayers.length < 2) return true;
  }

  if (card.id === "manipular-energia") {
    const isFreePlay = state.pendingDistorcaoTemporal && state.pendingDistorcaoTemporal.targetId === me.id;
    const finalCost = isFreePlay ? 0 : card.cost;
    const hasEnergySource = alivePlayers.some(p => {
      const postPlayEnergy = (p.id === me.id) ? (p.energy - finalCost) : p.energy;
      return postPlayEnergy >= 1;
    });
    if (!hasEnergySource) return true;
  }

  return false;
}

function renderHandCard(card, state, index = 0, total = 1) {
  const me = getMe();
  const blocked = isCardBlocked(card, state, me);
  const reactionMode = Boolean(state.pendingReaction);
  const center = (total - 1) / 2;
  const offset = (index - center) * 92;
  const rotation = (index - center) * 7;

  return `
    <article
      class="tcg-card play-card ${card.type} ${blocked ? "unplayable" : ""} ${reactionMode && card.type !== "reaction" ? "reaction-muted" : ""} ${reactionMode && card.type === "reaction" ? "reaction-ready" : ""}"
      data-hand-card="${card.uid}"
      role="listitem"
      tabindex="0"
      style="--hand-offset: ${offset}px; --hand-rotate: ${rotation}deg;"
    >
      <div class="card-cost" ${card.lifeCost ? 'style="background: #ef4444; border-color: #ef4444; color: white;"' : ''}>${card.lifeCost ? `${card.lifeCost}❤️` : card.cost}</div>
      <img src="${getCardArt(card)}" alt="" />
      <div class="card-body">
        <strong>${escapeHtml(card.name)}</strong>
        <p>${escapeHtml(card.text)}</p>
        ${renderCardTags(card)}
      </div>
    </article>
  `;
}

function renderArenaCard(card) {
  return `
    <article class="table-card ${card.type} ${card.uid === local.justPlayedUid ? "just-played" : ""}" tabindex="0">
      <div class="table-card-face">
        <img src="${getCardArt(card)}" alt="" />
        <div>
          <strong>${escapeHtml(card.name)}</strong>
          <span>${escapeHtml(card.playedBy)}</span>
        </div>
      </div>
      <div class="table-card-back">
        <span class="eyebrow">Carta jogada</span>
        <strong>${escapeHtml(card.name)}</strong>
        <p>${escapeHtml(card.text || "Efeito nao registrado.")}</p>
        ${renderCardTags(card)}
        ${Number.isFinite(card.cost) ? `<span class="table-cost">Custo ${card.cost}</span>` : ""}
      </div>
    </article>
  `;
}

function renderCardTags(card) {
  const tags = [
    card.damage ? `Dano ${card.damage}` : "",
    card.areaDamage ? `Area ${card.areaDamage}` : "",
    card.ignoreShield ? "Ignora Escudo" : "",
    card.heal ? `Cura ${card.heal}` : "",
    card.allHeal ? `Cura todos ${card.allHeal}` : "",
    card.block ? `Escudo ${card.block}` : "",
    card.selfBlock ? `Escudo +${card.selfBlock}` : "",
    card.allBlock ? `Todos Escudo ${card.allBlock}` : "",
    card.energy ? `Energia +${card.energy}` : "",
    card.allEnergy ? `Todos Energia +${card.allEnergy}` : "",
    card.draw ? (card.planning ? `Compra 2 / Descarta 1` : `Compra ${card.draw}`) : "",
    card.planning ? "" : "",
    card.revive ? `Reviver ${card.revive}` : "",
    card.moveShield ? "Mover Escudo" : "",
    card.shareShields ? "Redistribuir Escudos" : "",
    card.removeTrap ? "Remover Armadilha" : "",
    card.supremeEffects ? "\u2728 Suprema" : "",
    card.provoke ? "Provocar" : "",
    card.intercept ? "Interceptar" : "",
    card.reflect ? `Refletir ${card.reflect}` : "",
    card.reduceDamage ? `Reduz Dano ${card.reduceDamage}` : "",
    card.enemyChallenge ? "Desafio" : "",
    card.lowLifeMax ? `Vida <= ${card.lowLifeMax}` : ""
  ].filter(Boolean);

  return tags.length ? `<div class="card-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
}

function renderPendingDiscardModal(state, me) {
  if (local.animRunning) return "";
  if (!(me.pendingDiscard > 0)) return "";
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="discardTitle">
      <div class="glass-panel reaction-panel discard-modal">
        <span class="eyebrow">Descarte pendente</span>
        <h2 id="discardTitle">Escolha ${me.pendingDiscard} carta(s) para descartar</h2>
        <p class="muted">Clique em uma carta abaixo para descarta-la.</p>
        <div class="reaction-cards">
          ${me.hand.map((card) => `
            <article class="tcg-card reaction-choice">
              <div class="card-cost" ${card.lifeCost ? 'style="background: #ef4444; border-color: #ef4444; color: white;"' : ''}>${card.lifeCost ? `${card.lifeCost}❤️` : card.cost}</div>
              <div class="card-body">
                <strong>${escapeHtml(card.name)}</strong>
                <p>${escapeHtml(card.text)}</p>
              </div>
              <button data-discard-card="${card.uid}" class="danger">Descartar</button>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderPendingReciclagemModal(state, me) {
  if (local.animRunning) return "";
  const rec = state.pendingReciclagem;
  if (!rec) return "";
  if (rec.playerId !== me.id) {
    const waitingPlayerName = state.players.find(p => p.id === rec.playerId)?.name || "Elerion";
    return `
      <div class="modal-lightbox">
        <div class="modal-content text-center">
          <h2>Reciclagem em Andamento</h2>
          <p class="muted">Aguardando ${escapeHtml(waitingPlayerName)} escolher as cartas para trocar...</p>
        </div>
      </div>
    `;
  }

  const eligibleCards = me.hand.filter(c => rec.initialCardUids && rec.initialCardUids.includes(c.uid));

  return `
    <div class="modal-lightbox">
      <div class="modal-content">
        <h2>Reciclagem</h2>
        <p class="muted">Escolha quais cartas descartar da sua mão para comprar novas de graça.</p>
        <p class="accent" style="margin: 10px 0; font-size: 1.1em;">Cartas trocadas nesta ação: <strong>${rec.discardedCount}</strong></p>
        
        <div style="margin-bottom: 20px;">
          <button id="finishReciclagem" class="primary" style="padding: 10px 20px; font-weight: bold; font-size: 1.1em;">Confirmar Troca</button>
        </div>

        <div class="reaction-cards">
          ${eligibleCards.length === 0 ? `
            <p class="muted" style="margin: 20px 0; text-align: center; width: 100%;">Não restam mais cartas elegíveis da sua mão inicial para trocar.</p>
          ` : eligibleCards.map((card) => `
            <article class="tcg-card reaction-choice">
              <div class="card-cost" ${card.lifeCost ? 'style="background: #ef4444; border-color: #ef4444; color: white;"' : ''}>${card.lifeCost ? `${card.lifeCost}❤️` : card.cost}</div>
              <div class="card-body">
                <strong>${escapeHtml(card.name)}</strong>
                <p>${escapeHtml(card.text)}</p>
              </div>
              <button data-rec-discard-card="${card.uid}" class="danger">Trocar (Comprar 1)</button>
            </article>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}


function renderRewardSelectionModal(state, me) {
  if (local.animRunning) return "";
  if (!local.rewardModalOpen) return "";
  
  const chosen = me.chosenRewards || [];
  const heroArt = getHeroCardArt(me.heroId);
  
  const options = [
    {
      id: "energy",
      name: "Energia Maxima",
      cost: "+1⚡",
      desc: "Aumenta permanentemente sua Energia maxima em +1."
    },
    {
      id: "handSize",
      name: "Tamanho da Mao",
      cost: "+1🎴",
      desc: "Aumenta permanentemente o limite maximo de cartas na mao em +1."
    },
    {
      id: "redraw",
      name: "Troca de Mao",
      cost: "1x",
      desc: "Ganha a opcao de trocar todas as cartas da mao uma vez em qualquer momento da proxima sala."
    }
  ];
  
  const allExhausted = options.every(opt => chosen.includes(opt.id));
  
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="rewardTitle">
      <div class="glass-panel reaction-panel reward-selection-modal" style="max-width: 800px; padding: 24px; text-align: center;">
        <span class="eyebrow">Conclusao de Sala</span>
        <h2 id="rewardTitle">Escolha sua Recompensa</h2>
        <p class="muted" style="margin-bottom: 20px;">Cada recompensa so pode ser escolhida uma unica vez por partida.</p>
        
        ${allExhausted ? `
          <div class="all-rewards-obtained" style="margin: 32px 0;">
            <h3 style="color: #ffd785; font-size: 1.4rem; margin-bottom: 8px;">✨ Todas as Recompensas Obtidas!</h3>
            <p class="muted">Voce ja resgatou todas as melhorias disponiveis para esta partida.</p>
          </div>
          <button id="confirmRewardBtn" class="reward-confirm-btn" style="background: linear-gradient(135deg, #ffd785, #a8720a); color: #1a1000; font-weight: 900; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1rem; width: 100%;">
            Confirmar e Continuar
          </button>
        ` : `
          <div class="reward-cards-container" style="display: flex; gap: 16px; justify-content: center; margin-bottom: 24px; flex-wrap: wrap;">
            ${options.map(opt => {
              const isAlreadyChosen = chosen.includes(opt.id);
              const isSelected = local.selectedRewardId === opt.id;
              
              return `
                <article class="tcg-card reward-card-choice ${opt.id} ${isAlreadyChosen ? 'reward-disabled' : ''} ${isSelected ? 'reward-selected' : ''}" 
                         data-reward-id="${opt.id}">
                  <div class="card-cost">${opt.cost}</div>
                  <img src="${heroArt}" alt="" />
                  <div class="card-body">
                    <strong>${escapeHtml(opt.name)}</strong>
                    <p>${escapeHtml(opt.desc)}</p>
                  </div>
                  ${isAlreadyChosen ? `
                    <div class="already-chosen-badge">
                      JÁ ESCOLHIDA
                    </div>
                  ` : ""}
                </article>
              `;
            }).join("")}
          </div>
          
          <button id="confirmRewardBtn" class="reward-confirm-btn" ${!local.selectedRewardId ? 'disabled' : ''} 
                  style="background: ${local.selectedRewardId ? 'linear-gradient(135deg, #ffd785, #a8720a)' : '#444'}; 
                         color: ${local.selectedRewardId ? '#1a1000' : '#888'}; 
                         font-weight: 900; border: none; padding: 12px 24px; border-radius: 8px; 
                         cursor: ${local.selectedRewardId ? 'pointer' : 'not-allowed'}; font-size: 1rem; width: 100%; transition: all 0.2s;">
            Escolher Recompensa
          </button>
        `}
      </div>
    </div>
  `;
}

function renderShieldAllocationModal(state, me) {
  if (local.animRunning) return "";
  const alloc = state.pendingShieldAllocation;
  if (!alloc) return "";
  const total = alloc.totalShield ?? state.players.reduce((s, p) => s + p.shield, 0);
  const alivePlayers = state.players.filter((p) => p.life > 0);
  const title = alloc.mode === "share" ? `Redistribuir ${total} de Escudo` : "Mover Escudo entre aliados";
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="shieldAllocTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal">
        <span class="eyebrow">Distribuicao de Escudo</span>
        <h2 id="shieldAllocTitle">${escapeHtml(title)}</h2>
        <p class="muted">Total disponivel: <strong>${total}</strong>. Distribua entre os herois e confirme.</p>
        <div class="shield-alloc-fields">
          ${alivePlayers.map((p) => `
            <label>${escapeHtml(p.name)} (atual: ${p.shield})
              <input class="shield-alloc-input" data-pid="${p.id}" type="number" min="0" max="${total}" value="${p.shield}" style="width:70px"/>
            </label>
          `).join("")}
        </div>
        <button id="confirmShieldAlloc">Confirmar Escudos</button>
      </div>
    </div>
  `;
}

function renderEnergyAllocationModal(state, me) {
  if (local.animRunning) return "";
  const alloc = state?.pendingEnergyAllocation;
  if (!alloc) return "";
  const alivePlayers = state.players.filter((p) => p.life > 0);
  
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="energyAllocTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow">Manipulacao de Energia</span>
        <h2 id="energyAllocTitle">Mover Energia</h2>
        <p class="muted">Escolha a origem, o destino e a quantidade de energia (limite 2⚡).</p>
        
        <div class="energy-alloc-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <strong>Origem:</strong>
            <select id="energyAllocFrom" style="padding: 6px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              ${alivePlayers.filter(p => p.energy > 0).map(p => `
                <option value="${p.id}">${escapeHtml(p.name)} (${p.energy}⚡)</option>
              `).join("")}
            </select>
          </label>
          
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <strong>Destino:</strong>
            <select id="energyAllocTo" style="padding: 6px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              ${alivePlayers.map(p => `
                <option value="${p.id}">${escapeHtml(p.name)} (${p.energy}⚡)</option>
              `).join("")}
            </select>
          </label>
          
          <label style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <strong>Quantidade:</strong>
            <select id="energyAllocAmount" style="padding: 6px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              <option value="1">1⚡</option>
              <option value="2">2⚡</option>
            </select>
          </label>
        </div>
        
        <button id="confirmEnergyAlloc">Confirmar Transferencia</button>
      </div>
    </div>
  `;
}

function renderEcoArcanoModal(state, me) {
  if (local.animRunning) return "";
  const alloc = state?.pendingEcoArcano;
  if (!alloc || alloc.casterId !== me?.id) return "";
  
  const playedInfo = state.cartas_jogadas_esta_rodada || [];
  const eligible = [];
  const addedIds = new Set();
  playedInfo.forEach(info => {
    if (info.cardId === "eco-arcano") return;
    let config = null;
    for (const list of Object.values(local.heroCards || {})) {
      const found = list.find(c => c.id === info.cardId);
      if (found) { config = found; break; }
    }
    if (config && config.cost !== 0 && !addedIds.has(config.id)) {
      addedIds.add(config.id);
      eligible.push(config);
    }
  });
  
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="ecoTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow">Magia Arcana</span>
        <h2 id="ecoTitle">Eco Arcano</h2>
        <p class="muted">Escolha uma carta jogada nesta rodada para repetir seus efeitos.</p>
        
        ${eligible.length === 0 ? `
          <p class="muted" style="margin: 16px 0; text-align: center;">Nenhuma carta elegível foi jogada por você nesta rodada ainda.</p>
          <button id="cancelEco" style="width: 100%;">Fechar</button>
        ` : `
          <div class="eco-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <strong>Carta a copiar:</strong>
              <select id="ecoCardSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
                ${eligible.map(c => `<option value="${c.id}" data-type="${c.type}" data-target="${c.target || ""}">${escapeHtml(c.name)} (${c.cost}⚡) - ${escapeHtml(c.text)}</option>`).join("")}
              </select>
            </label>
            
            <div id="ecoTargetContainer" style="display: flex; flex-direction: column; gap: 4px;">
              <strong>Alvo da magia:</strong>
              <select id="ecoTargetSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              </select>
            </div>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button id="confirmEco" style="flex: 1;">Reconjurada!</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderDistorcaoTemporalModal(state, me) {
  if (local.animRunning) return "";
  const alloc = state?.pendingDistorcaoTemporal;
  if (!alloc || alloc.targetId !== me?.id) return "";
  
  const caster = state.players.find(p => p.id === alloc.casterId);
  const eligible = me.hand.filter(c => c.cost <= 3 && c.type !== "reaction");
  
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="distorcaoTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow">Distorcao Temporal</span>
        <h2 id="distorcaoTitle">Conjuracao Temporal</h2>
        <p class="muted">${escapeHtml(caster ? caster.name : "Mago")} lhe concedeu uma acao extra. Escolha uma carta de custo 3 ou menos para jogar gratuitamente.</p>
        
        ${eligible.length === 0 ? `
          <p class="muted" style="margin: 16px 0; text-align: center;">Você não possui cartas de custo 3 ou menos na mão.</p>
          <button id="skipDistorcao" style="width: 100%;">Pular</button>
        ` : `
          <div class="distorcao-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <strong>Selecione a carta:</strong>
              <select id="distorcaoCardSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
                ${eligible.map(c => `<option value="${c.uid}">${escapeHtml(c.name)} (custo original: ${c.cost}⚡) - ${escapeHtml(c.text)}</option>`).join("")}
              </select>
            </label>
            
            <div id="distorcaoTargetContainer" style="display: flex; flex-direction: column; gap: 4px;">
              <strong>Alvo da magia (se necessario):</strong>
              <select id="distorcaoTargetSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              </select>
            </div>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button id="confirmDistorcao" style="flex: 1;">Jogar de Graca!</button>
            <button id="skipDistorcao" class="secondary">Pular</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderEspelhoArcanoModal(state, me) {
  if (local.animRunning) return "";
  const mirror = state.pendingEspelhoArcano;
  if (!mirror || mirror.casterId !== me?.id) return "";

  const aliveEnemies = state.enemies.filter(e => e.life > 0);
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="espelhoArcanoTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow" style="color: #db2777;">Espelho Arcano</span>
        <h2 id="espelhoArcanoTitle">Redirecionar Ataque</h2>
        <p class="muted">O ataque de <strong>${escapeHtml(mirror.enemyName)}</strong> (${mirror.attackDamage} de dano) está sendo redirecionado! Escolha o inimigo alvo para receber o ataque.</p>
        
        <div class="espelho-arcano-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <strong>Redirecionar para:</strong>
            <select id="espelhoArcanoTargetSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              ${aliveEnemies.map(e => `<option value="${e.uid}">${escapeHtml(e.name)} (Vida: ${e.life}/${e.maxLife}, Esc: ${e.shield})</option>`).join("")}
            </select>
          </label>
        </div>
        
        <button id="confirmEspelhoArcano" style="width: 100%;">Confirmar Redirecionamento</button>
      </div>
    </div>
  `;
}

function renderAmplificarModal(state, me) {
  if (local.animRunning) return "";
  const amp = state.pendingAmplificar;
  if (!amp || amp.casterId !== me?.id) return "";

  const playedList = state.cartas_jogadas_esta_rodada || [];
  const eligible = playedList.filter(item => item.cardId !== "amplificar" && item.cardId !== "cataclismo-arcano" && item.cardId !== "eco-arcano");

  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="ampTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow" style="color: #a855f7;">Magia Arcana</span>
        <h2 id="ampTitle">Amplificar Efeito</h2>
        <p class="muted">Escolha uma carta jogada nesta rodada por qualquer herói para repetir seus efeitos nos mesmos alvos.</p>
        
        ${eligible.length === 0 ? `
          <p class="muted" style="margin: 16px 0; text-align: center;">Nenhuma carta elegível foi jogada por aliados nesta rodada ainda.</p>
          <button id="cancelAmplificar" style="width: 100%;">Fechar</button>
        ` : `
          <div class="amp-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
            <label style="display: flex; flex-direction: column; gap: 4px;">
              <strong>Carta a amplificar:</strong>
              <select id="ampCardSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
                ${eligible.map((item, idx) => {
                  const casterPlayer = state.players.find(p => p.id === item.casterId);
                  const casterName = casterPlayer ? casterPlayer.name : "Aliado";
                  
                  let targetName = "";
                  const tEnemy = state.enemies.find(e => e.uid === item.targetId);
                  if (tEnemy) targetName = tEnemy.name;
                  const tPlayer = state.players.find(p => p.id === item.targetId);
                  if (tPlayer) targetName = tPlayer.name;

                  return `<option value="${idx}" data-card-id="${item.cardId}" data-target-id="${item.targetId || ""}">${escapeHtml(item.cardId)} (jogada por ${escapeHtml(casterName)}${targetName ? ` em ${escapeHtml(targetName)}` : ""})</option>`;
                }).join("")}
              </select>
            </label>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button id="confirmAmplificar" style="flex: 1;">Amplificar!</button>
            <button id="cancelAmplificar" class="secondary">Cancelar</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCataclismoArcanoModal(state, me) {
  if (local.animRunning) return "";
  const cat = state.pendingCataclismoArcano;
  if (!cat || cat.casterId !== me?.id) return "";

  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="cataclismoArcanoTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow" style="color: #a855f7;">Suprema Arcanista</span>
        <h2 id="cataclismoArcanoTitle">Cataclismo Arcano: Terreno</h2>
        <p class="muted">Escolha um Terreno Arcano para estabelecer no campo de batalha:</p>
        
        <div class="cataclismo-arcano-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
          <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer; margin-bottom: 8px;">
            <input type="radio" name="cataclismoTerrainRadio" value="CHAO_DE_GELO" checked />
            <div>
              <strong>Chão de Gelo</strong><br/>
              <span class="muted" style="font-size: 0.85em;">Todos os ataques inimigos causam 1 de dano a menos (mínimo 1).</span>
            </div>
          </label>
          <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer;">
            <input type="radio" name="cataclismoTerrainRadio" value="VORTICE_ARCANO" />
            <div>
              <strong>Vórtice Arcano</strong><br/>
              <span class="muted" style="font-size: 0.85em;">Todos os heróis recuperam 1 de Energia adicional no início de cada rodada.</span>
            </div>
          </label>
        </div>
        
        <button id="confirmCataclismoArcano" style="width: 100%;">Estabelecer Terreno</button>
      </div>
    </div>
  `;
}

function renderTempestadeEletricaModal(state, me) {
  if (local.animRunning) return "";
  const temp = state.pendingTempestadeEletrica;
  if (!temp || temp.casterId !== me?.id) return "";

  const aliveEnemies = state.enemies.filter(e => e.life > 0);
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="tempestadeEletricaTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow" style="color: #3b82f6;">Tempestade Eletrica</span>
        <h2 id="tempestadeEletricaTitle">Alvo Secundário</h2>
        <p class="muted">Selecione outro inimigo para receber 3 de dano adicional da Tempestade Elétrica:</p>
        
        <div class="tempestade-eletrica-fields" style="display: flex; flex-direction: column; gap: 12px; margin: 16px 0; text-align: left;">
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <strong>Segundo Alvo:</strong>
            <select id="tempestadeEletricaTargetSelect" style="padding: 8px; border-radius: 4px; background: rgba(0,0,0,0.5); color:#fff; border: 1px solid rgba(255,255,255,0.2);">
              ${aliveEnemies.map(e => `<option value="${e.uid}">${escapeHtml(e.name)} (Vida: ${e.life}/${e.maxLife})</option>`).join("")}
            </select>
          </label>
        </div>
        
        <button id="confirmTempestadeEletrica" style="width: 100%;">Confirmar Segundo Alvo</button>
      </div>
    </div>
  `;
}

function renderEmptyArena() {
  return `
    <div class="empty-arena">
      <div class="summon-circle"></div>
      <span>Aguardando cartas</span>
    </div>
  `;
}

function renderMeter(kind, value, max, label, key) {
  const valuePct = pct(value, max);
  const fromPct = key && local.previousMeters[key] ? local.previousMeters[key] : valuePct;
  const changed = fromPct !== valuePct;
  return `
    <div class="meter ${kind} ${changed ? "meter-animating" : ""}" aria-label="${label}">
      <span style="--from: ${fromPct}; --value: ${valuePct}"></span>
      <em>${value}/${max}</em>
    </div>
  `;
}

function renderEnergyPips(value, max) {
  return Array.from({ length: max }, (_, index) => `<span class="energy-pip ${index < value ? "filled" : ""}"></span>`).join("");
}

function renderToast() {
  if (!local.toast) return "";
  return `<div class="toast ${local.toastTone}">${escapeHtml(local.toast)}</div>`;
}

function exportToPDF() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Bloqueador de popups impediu a exportação. Por favor, permita popups para este site.", "warning");
    return;
  }

  // 1. Build Manual HTML
  let manualHtml = `
    <h2>1. Manual do Jogo</h2>
    <p>O <strong>Web Card Game</strong> é um jogo de cartas cooperativo de combate em masmorras. Você e seus companheiros devem selecionar heróis e trabalhar em equipe para sobreviver e derrotar os monstros que habitam cada sala da masmorra.</p>
    
    <h3>🛡️ Seleção de Heróis e Baralhos</h3>
    <p>Cada jogador escolhe um herói com atributos iniciais e um baralho próprio de cartas:</p>
    <ul>
      <li><strong>Donovan (32 Vida, 4 Energia):</strong> Focado em escudos, redução de dano e reações para interceptar golpes e proteger os aliados.</li>
      <li><strong>Niely (24 Vida, 5 Energia):</strong> Especialista em curar o grupo, redistribuir escudos e conceder energia/cartas adicionais.</li>
      <li><strong>Elerion (28 Vida, 4 Energia):</strong> Focado em causar dano físico de precisão, tiros rápidos e perfurar escudos.</li>
      <li><strong>Arcanista Vince (26 Vida, 6 Energia):</strong> Alto dano mágico em área, feitiços de controle de grupo e aceleração/manipulação de recursos.</li>
    </ul>
    <p><strong>Cartas Supremas:</strong> Cada herói possui uma carta Suprema especial. Ela fica fora do seu deck e pode ser conjurada diretamente da mesa a qualquer momento no seu turno. Pode ser usada apenas uma única vez por partida.</p>

    <h3>🚪 Início da Sala e Rodadas</h3>
    <p>A aventura é dividida em Salas de Combate. Cada rodada segue as seguintes etapas:</p>
    <ol>
      <li><strong>Seleção da Sala (Início da masmorra):</strong> O grupo escolhe uma Carta de Sala que define o tema, quantos monstros Comuns e Brutais surgirão, uma regra especial constante e a recompensa final da sala.</li>
      <li><strong>Fase de Preparação:</strong> No início de cada rodada, uma Carta de Intenção da masmorra é revelada (mostrando quem os inimigos planejam atacar) e uma Armadilha (se houver) aplica seus efeitos prejudiciais.</li>
      <li><strong>Restauração e Compra:</strong> Todos os heróis recuperam sua Energia ao máximo e compram cartas até atingir o seu Limite de Mão (limite inicial de 5 cartas).</li>
    </ol>

    <h3>🔄 Fim do Deck (Baralho Vazio)</h3>
    <p>Se em algum momento da partida o seu deck de compras ficar sem cartas quando você precisar comprar (seja na fase de compra ou devido ao efeito de alguma magia), a sua pilha de descartes é automaticamente embaralhada de volta no seu deck de compras. Você nunca perde suas cartas!</p>

    <h3>🎯 Mecânica de Alvos e Desempates (Regra de Ouro)</h3>
    <p>No final da rodada, a masmorra ataca. Os monstros atacam com base na Carta de Intenção ativa (ex: "comuns atacam quem tem mais vida", "brutais atacam quem tem menos escudo").</p>
    <p>Se houver um empate no critério da intenção (por exemplo: a intenção diz "atacar quem tem menos escudo" e ambos os heróis estão com 0 escudo; ou "quem recebeu mais cura" e a rodada acabou de começar sem cura realizada), o jogo ativa a regra de Desempate Universal na seguinte ordem de prioridade:</p>
    <ol>
      <li><strong>Menos Vida atual:</strong> O monstro ataca o herói com menos Vida restante.</li>
      <li><strong>Menos Escudo atual:</strong> Se a vida for idêntica, ataca quem tiver menos Escudo.</li>
      <li><strong>Menos Cartas na Mão:</strong> Se ambos forem iguais, ataca quem tiver menos cartas na mão.</li>
      <li><strong>Ordem de Turno / Lobby:</strong> Se o empate persistir, o monstro ataca conforme a ordem do lobby (Donovan &rarr; Niely &rarr; Elerion &rarr; Mago).</li>
    </ol>
    <p><em>Importante:</em> O critério é avaliado no exato momento do ataque. Se a intenção for "menos escudo" e ambos os jogadores tiveram seus escudos zerados por ataques anteriores na mesma rodada, o histórico não conta; é considerado um empate (0x0) e segue a ordem de desempate acima (menos Vida atual).</p>

    <h3>⚡ Ações e a Janela de Reação</h3>
    <p>Durante a sua fase de ações, você joga cartas da mão gastando a Energia necessária indicada no canto da carta. Quando todos terminam, a fase da masmorra começa.</p>
    <p><strong>Janela de Reações:</strong> Quando um monstro declara um ataque contra um herói, antes de sofrer o dano, o jogo abre uma janela especial. Qualquer jogador que tenha cartas do tipo Reação na mão pode jogá-las (ex: Interceptar, Contra-Ataque, etc.) para alterar o alvo, anular o dano ou contra-atacar. Se ninguém quiser ou puder reagir, os jogadores devem clicar em Pular para que o dano seja resolvido.</p>

    <h3>💎 Conclusão de Sala e Recompensas</h3>
    <p>Ao derrotar todos os monstros e concluir o objetivo da sala, os jogadores podem escolher uma recompensa permanente. Cada recompensa só pode ser selecionada uma única vez por partida:</p>
    <ul>
      <li><strong>Energia Máxima:</strong> Aumenta permanentemente sua Energia máxima em +1⚡.</li>
      <li><strong>Tamanho da Mão:</strong> Aumenta permanentemente o limite de cartas que você pode manter na mão em +1🎴.</li>
      <li><strong>Troca de Mão (Redraw):</strong> Concede a habilidade de descartar toda a sua mão e comprar novas cartas uma vez por sala.</li>
    </ul>
  `;

  // 2. Build Glossary HTML
  let glossaryHtml = `<h2>2. Glossário de Termos</h2><table class="rule-table"><thead><tr><th>Termo</th><th>Descrição</th></tr></thead><tbody>`;
  glossaryEntries.forEach(([term, desc]) => {
    glossaryHtml += `<tr><td><strong>${escapeHtml(term)}</strong></td><td>${escapeHtml(desc)}</td></tr>`;
  });
  glossaryHtml += `</tbody></table>`;

  // 3. Build Hero Cards HTML
  let heroesHtml = "<h2>3. Cartas dos Heróis</h2>";
  const heroesList = local.heroes || [];
  const heroCardsMap = local.heroCards || {};
  heroesList.forEach(hero => {
    heroesHtml += `<h3>${escapeHtml(hero.name)} (${hero.life} Vida, ${hero.energy} Energia)</h3>`;
    heroesHtml += `<div class="card-grid">`;
    const cards = heroCardsMap[hero.id] || [];
    cards.forEach(card => {
      const isSupreme = card.id === "bastiao-supremo" || card.id === "luz-da-esperanca" || card.id === "tempestade-de-flechas";
      heroesHtml += `
        <div class="print-card">
          <div class="card-header">
            <span class="card-cost">${card.cost}⚡</span>
            <strong>${escapeHtml(card.name)}</strong>
            <span class="card-type">${escapeHtml(card.type)}${isSupreme ? " (Suprema)" : ""}</span>
          </div>
          <p>${escapeHtml(card.text)}</p>
        </div>
      `;
    });
    heroesHtml += `</div>`;
  });

  // 4. Build Rooms HTML
  let roomsHtml = "<h2>4. Cartas de Sala</h2><div class=\"card-grid\">";
  const roomCards = local.roomCards || [];
  roomCards.forEach(room => {
    roomsHtml += `
      <div class="print-card">
        <div class="card-header">
          <strong>${escapeHtml(room.name)}</strong>
          <span class="card-type">${escapeHtml(room.theme)}</span>
        </div>
        <p><em>${escapeHtml(room.subtitle || "")}</em></p>
        <p>🎯 <strong>Objetivo:</strong> ${escapeHtml(room.objective)}</p>
        <p>⚠️ <strong>Regra Especial:</strong> ${escapeHtml(room.rule)}</p>
        <p>👾 <strong>Setup:</strong> ${room.setup?.common || 0} Comuns, ${room.setup?.brutal || 0} Brutais</p>
      </div>
    `;
  });
  roomsHtml += "</div>";

  // 5. Build Intentions HTML
  let intentionsHtml = "<h2>5. Cartas de Intenção</h2><div class=\"card-grid\">";
  const intentionCards = local.intentionCards || [];
  intentionCards.forEach(intention => {
    intentionsHtml += `
      <div class="print-card new-intention-v2" style="background: rgba(13, 24, 30, 0.82); border: 1px solid rgba(255, 246, 223, 0.16); padding: 14px; border-radius: 8px; color: #f0ebe3;">
        <div class="intention-header" style="border-bottom: 2px solid #C9922A; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #F5E6C4; font-size: 1.1rem;">${escapeHtml(intention.name)}</strong>
          <span class="card-cost" style="color: #C9922A; font-weight: bold;">${escapeHtml(intention.id)}</span>
        </div>
        <div class="intention-rules-v2" style="display: grid; gap: 6px; font-size: 0.85rem;">
          <div class="section-v2 presagio-v2" style="background: rgba(217, 119, 6, 0.1); border-left: 3px solid #d97706; padding: 6px 10px; border-radius: 4px; color: #ffe3b3;">
            <strong>⚡ Presságio</strong>: ${escapeHtml(intention.presagioText)}
          </div>
          <div class="section-v2 comum-v2" style="background: rgba(37, 99, 235, 0.1); border-left: 3px solid #2563eb; padding: 6px 10px; border-radius: 4px; color: #dbeafe;">
            <strong>👤 Comuns</strong> <code>(${escapeHtml(intention.commonTarget)})</code>: ${escapeHtml(intention.commonText)}
          </div>
          <div class="section-v2 brutal-v2" style="background: rgba(220, 38, 38, 0.1); border-left: 3px solid #dc2626; padding: 6px 10px; border-radius: 4px; color: #fee2e2;">
            <strong>👹 Brutais</strong> <code>(${escapeHtml(intention.brutalTarget)})</code>: ${escapeHtml(intention.brutalText)}
          </div>
          <div class="section-v2 represalia-v2" style="background: rgba(124, 58, 237, 0.1); border-left: 3px solid #7c3aed; padding: 6px 10px; border-radius: 4px; color: #f3e8ff;">
            <strong>💀 Represália</strong>: ${escapeHtml(intention.represaliaText)}
          </div>
        </div>
      </div>
    `;
  });
  intentionsHtml += "</div>";

  // 6. Build Traps HTML
  let trapsHtml = "<h2>6. Armadilhas</h2><div class=\"card-grid\">";
  const trapCards = local.trapCards || [];
  trapCards.forEach(trap => {
    trapsHtml += `
      <div class="print-card">
        <div class="card-header">
          <strong>${escapeHtml(trap.name)}</strong>
          <span class="card-cost">${escapeHtml(trap.id)}</span>
        </div>
        <p>🕸️ <strong>Efeito:</strong> ${escapeHtml(trap.text)}</p>
      </div>
    `;
  });
  trapsHtml += "</div>";

  // Combine document
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Web Card Game - Manual e Biblioteca de Regras</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          color: #333;
          background: #fff;
          line-height: 1.5;
          margin: 40px;
          font-size: 13px;
        }
        h1, h2, h3, h4 {
          color: #111;
          margin-top: 18px;
          margin-bottom: 8px;
        }
        h1 {
          font-size: 2.2rem;
          text-align: center;
          border-bottom: 3px double #333;
          padding-bottom: 12px;
          margin-bottom: 30px;
        }
        h2 {
          font-size: 1.6rem;
          border-bottom: 2px solid #333;
          padding-bottom: 6px;
          margin-top: 36px;
          page-break-before: always;
        }
        h3 {
          font-size: 1.15rem;
          color: #8b5a24;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
          margin-top: 20px;
        }
        .card-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .print-card {
          border: 1px solid #ccc;
          border-radius: 6px;
          padding: 10px;
          background: #fafafa;
          page-break-inside: avoid;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .card-cost {
          background: #e0f7fa;
          color: #006064;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 0.8rem;
        }
        .card-type {
          font-size: 0.7rem;
          text-transform: uppercase;
          padding: 1px 5px;
          border-radius: 3px;
          background: #eee;
          border: 1px solid #ddd;
        }
        .rule-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        .rule-table th, .rule-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .rule-table th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        ul, ol {
          padding-left: 18px;
        }
        li {
          margin-bottom: 4px;
        }
        code {
          font-family: monospace;
          background: #eee;
          padding: 1px 3px;
          border-radius: 3px;
          font-size: 0.85rem;
        }
        .no-print-bar {
          background: #f5f5f5;
          border: 1px solid #ddd;
          padding: 10px;
          margin-bottom: 20px;
          text-align: center;
          border-radius: 4px;
        }
        .no-print-bar button {
          background: #8b5a24;
          color: white;
          border: none;
          padding: 8px 16px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          border-radius: 4px;
        }
        .no-print-bar button:hover {
          background: #a06e36;
        }
        @media print {
          .no-print-bar {
            display: none;
          }
          body {
            margin: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <p>Esta é a visualização de impressão das regras. Escolha <strong>Salvar como PDF</strong> no destino da janela de impressão.</p>
        <button onclick="window.print()">Imprimir / Salvar como PDF</button>
      </div>
      <h1>Web Card Game - Manual & Biblioteca de Regras</h1>
      <p style="text-align: center; color: #666; font-style: italic;">Documento gerado em tempo real em ${new Date().toLocaleDateString("pt-BR")}</p>
      
      ${manualHtml}
      ${glossaryHtml}
      ${heroesHtml}
      ${roomsHtml}
      ${intentionsHtml}
      ${trapsHtml}
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function renderQuitConfirmModal() {
  if (!local.quitConfirmOpen) return "";
  return `
    <div id="quit-confirm-overlay" class="quit-confirm-overlay animate-fade-in">
      <div class="quit-confirm-card glass-panel">
        <div class="quit-confirm-header">
          <span class="warning-icon">⚠️</span>
          <h2>Abandonar Partida</h2>
        </div>
        <p>Você tem certeza que deseja sair da partida? Todo o seu progresso nesta sala será perdido.</p>
        <div class="quit-confirm-actions">
          <button id="quitConfirmYes" class="btn-quit-confirm danger">Sim, Sair</button>
          <button id="quitConfirmNo" class="btn-quit-confirm secondary">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function renderRulesModal() {
  if (!local.rulesOpen) return "";
  
  const isManual = local.rulesTab === "manual";
  const isGlossary = local.rulesTab === "glossary";
  const isCards = local.rulesTab === "cards";
  const isRooms = local.rulesTab === "rooms";
  const isIntentions = local.rulesTab === "intentions";
  const isTraps = local.rulesTab === "traps";
  
  const query = normalizeSearch(local.rulesQuery);
  const entries = glossaryEntries.filter(([term, description]) =>
    normalizeSearch(`${term} ${description}`).includes(query)
  );
  
  let tabContent = "";
  if (isManual) {
    tabContent = `
      <div class="rules-results manual-rules-container">
        <section class="manual-section">
          <h3>📖 Introdução ao Jogo</h3>
          <p>O <strong>Web Card Game</strong> é um jogo de cartas cooperativo de combate em masmorras. Você e seus companheiros devem selecionar heróis e trabalhar em equipe para sobreviver e derrotar os monstros que habitam cada sala da masmorra.</p>
        </section>

        <section class="manual-section">
          <h3>🛡️ Seleção de Heróis e Baralhos</h3>
          <p>Cada jogador escolhe um herói com atributos iniciais e um baralho próprio de cartas:</p>
          <ul>
            <li><strong>Donovan (32 Vida, 4 Energia):</strong> Focado em escudos, redução de dano e reações para interceptar golpes e proteger os aliados.</li>
            <li><strong>Niely (24 Vida, 5 Energia):</strong> Especialista em curar o grupo, redistribuir escudos e conceder energia/cartas adicionais.</li>
            <li><strong>Elerion (28 Vida, 4 Energia):</strong> Focado em causar dano físico de precisão, tiros rápidos e perfurar escudos.</li>
            <li><strong>Arcanista Vince (26 Vida, 6 Energia):</strong> Alto dano mágico em área, feitiços de controle de grupo e aceleração/manipulação de recursos.</li>
          </ul>
          <p>🌟 <strong>Cartas Supremas:</strong> Cada herói possui uma carta Suprema especial (ex: <em>Bastião Supremo</em>, <em>Luz da Esperança</em>, etc.). Ela fica fora do seu deck e pode ser conjurada diretamente da mesa a qualquer momento no seu turno. **Ela pode ser usada apenas uma única vez por partida**.</p>
        </section>

        <section class="manual-section">
          <h3>🚪 Início da Sala e Rodadas</h3>
          <p>A aventura é dividida em Salas de Combate. Cada rodada segue as seguintes etapas:</p>
          <ol>
            <li><strong>Seleção da Sala (Início da masmorra):</strong> O grupo escolhe uma Carta de Sala que define o tema, quantos monstros Comuns e Brutais surgirão, uma regra especial constante e a recompensa final da sala.</li>
            <li><strong>Fase de Preparação:</strong> No início de cada rodada, uma **Carta de Intenção** da masmorra é revelada (mostrando quem os inimigos planejam atacar) e uma **Armadilha** (se houver) aplica seus efeitos prejudiciais.</li>
            <li><strong>Restauração e Compra:</strong> Todos os heróis recuperam sua Energia ao máximo e compram cartas até atingir o seu **Limite de Mão** (limite inicial de 5 cartas).</li>
          </ol>
        </section>

        <section class="manual-section">
          <h3>🔄 Fim do Deck (Baralho Vazio)</h3>
          <p>Se em algum momento da partida o seu deck de compras ficar sem cartas quando você precisar comprar (seja na fase de compra ou devido ao efeito de alguma magia), a sua **pilha de descartes é automaticamente embaralhada** de volta no seu deck de compras. Você nunca perde suas cartas!</p>
        </section>

        <section class="manual-section">
          <h3>🎯 Mecânica de Alvos e Desempates (Regra de Ouro)</h3>
          <p>No final da rodada, a masmorra ataca. Os monstros atacam com base na <strong>Carta de Intenção</strong> ativa (ex: "comuns atacam quem tem mais vida", "brutais atacam quem tem menos escudo").</p>
          <p>Se houver um <strong>empate</strong> no critério da intenção (por exemplo: a intenção diz "atacar quem tem menos escudo" e ambos os heróis estão com 0 escudo; ou "quem recebeu mais cura" e a rodada acabou de começar sem cura realizada), o jogo ativa a regra de <strong>Desempate Universal</strong> na seguinte ordem de prioridade:</p>
          <ul>
            <li><strong>1º Critério:</strong> Monstro ataca quem tiver <strong>menos Vida atual</strong>.</li>
            <li><strong>2º Critério:</strong> Se a vida for idêntica, ataca quem tiver <strong>menos Escudo atual</strong>.</li>
            <li><strong>3º Critério:</strong> Se ainda empatar, ataca quem tiver <strong>menos cartas na mão</strong>.</li>
            <li><strong>4º Critério:</strong> Em caso de empate absoluto, o monstro ataca de acordo com a ordem do lobby (Donovan &rarr; Niely &rarr; Elerion &rarr; Mago).</li>
          </ul>
          <p>⚠️ <em>Importante:</em> O critério é avaliado no **exato momento** do ataque. Se a intenção for "menos escudo" e ambos os jogadores tiveram seus escudos zerados por ataques anteriores na mesma rodada, o histórico não conta; é considerado um empate ($0 \times 0$) e segue a ordem de desempate acima (menos Vida atual).</p>
        </section>

        <section class="manual-section">
          <h3>⚡ Ações e a Janela de Reação</h3>
          <p>Durante a sua fase de ações, você joga cartas da mão pagando seu custo em Energia. Quando todos terminam, a fase da masmorra começa.</p>
          <p>🛡️ <strong>Janela de Reações:</strong> Quando um monstro declara um ataque contra um herói, antes de sofrer o dano, o jogo abre uma janela especial. Qualquer jogador que tenha cartas do tipo <strong>Reação</strong> na mão pode jogá-las (ex: <em>Interceptar</em>, <em>Contra-Ataque</em>, etc.) para alterar o alvo, anular o dano ou contra-atacar. Se ninguém quiser ou puder reagir, os jogadores devem clicar em <strong>Pular</strong> para que o dano seja resolvido.</p>
        </section>

        <section class="manual-section">
          <h3>💎 Conclusão de Sala e Recompensas</h3>
          <p>Ao derrotar todos os monstros e concluir o objetivo da sala, os jogadores podem escolher uma recompensa permanente. Cada recompensa só pode ser selecionada **uma única vez por partida**:</p>
          <ul>
            <li><strong>Energia Máxima:</strong> Aumenta permanentemente sua Energia máxima em +1⚡.</li>
            <li><strong>Tamanho da Mão:</strong> Aumenta permanentemente o limite de cartas que você pode manter na mão em +1🎴.</li>
            <li><strong>Troca de Mão (Redraw):</strong> Concede a habilidade de descartar toda a sua mão e comprar novas cartas uma vez por sala.</li>
          </ul>
        </section>
      </div>
    `;
  } else if (isGlossary) {
    tabContent = `
      <label class="rules-search">
        Buscar termo
        <input id="rulesSearch" autocomplete="off" placeholder="Provocar, Escudo, Intencao..." value="${escapeHtml(local.rulesQuery)}" />
      </label>
      <div class="rules-results">
        ${
          entries.length
            ? entries
                .map(
                  ([term, description]) => `
                    <article class="rule-entry">
                      <strong>${escapeHtml(term)}</strong>
                      <p>${escapeHtml(description)}</p>
                    </article>
                  `
                )
                .join("")
            : `<p class="muted">Nenhuma regra encontrada para essa busca.</p>`
        }
      </div>
    `;
  } else if (isCards) {
    const heroesList = local.heroes || [];
    const heroCardsMap = local.heroCards || {};
    const selectedHeroId = local.rulesSelectedHero || (heroesList[0]?.id || "guardiao");
    const cards = heroCardsMap[selectedHeroId] || [];
    
    tabContent = `
      <div class="hero-tab-selectors">
        ${heroesList.map(h => `
          <button class="hero-tab-btn ${selectedHeroId === h.id ? "active" : ""}" data-hero-tab="${h.id}">
            ${escapeHtml(h.name)}
          </button>
        `).join("")}
      </div>
      <div class="rules-results cards-list-rules">
        ${cards.length ? cards.map(card => {
          const isSupreme = card.id === "bastiao-supremo" || card.id === "luz-da-esperanca" || card.id === "tempestade-de-flechas";
          return `
            <div class="rules-card-entry ${isSupreme ? "supreme-entry" : ""}">
              <div class="card-entry-header">
                <span class="card-entry-cost" ${card.lifeCost ? 'style="color: #ef4444;"' : ''}>${card.lifeCost ? `${card.lifeCost}❤️` : `${card.cost}⚡`}</span>
                <strong class="card-entry-name">${escapeHtml(card.name)}</strong>
                <span class="card-entry-type badge-${card.type}">${escapeHtml(card.type)}</span>
                ${isSupreme ? `<span class="supreme-badge">Suprema</span>` : ""}
              </div>
              <p class="card-entry-text">${escapeHtml(card.text)}</p>
            </div>
          `;
        }).join("") : `<p class="muted">Nenhum dado de carta de herói disponível.</p>`}
      </div>
    `;
  } else if (isRooms) {
    const roomCards = local.roomCards || [];
    tabContent = `
      <div class="rules-results cards-list-rules">
        ${roomCards.length ? roomCards.map(room => `
          <div class="rules-card-entry room-entry-card">
            <div class="card-entry-header">
              <span class="card-entry-cost">${escapeHtml(room.id)}</span>
              <strong class="card-entry-name">${escapeHtml(room.name)}</strong>
              <span class="card-entry-type theme-${room.theme}">${escapeHtml(room.theme)}</span>
            </div>
            <p class="card-entry-subtitle"><em>${escapeHtml(room.subtitle || "")}</em></p>
            <div style="margin-top: 8px; display: grid; gap: 4px;">
              <p class="card-entry-text">🎯 <strong>Objetivo:</strong> ${escapeHtml(room.objective)}</p>
              <p class="card-entry-text">⚠️ <strong>Regra Especial:</strong> ${escapeHtml(room.rule)}</p>
              <p class="card-entry-text">👾 <strong>Setup Inicial:</strong> ${room.setup?.common || 0} Comuns, ${room.setup?.brutal || 0} Brutais</p>
            </div>
          </div>
        `).join("") : `<p class="muted">Nenhuma sala disponível no momento.</p>`}
      </div>
    `;
  } else if (isIntentions) {
    const intentionCards = local.intentionCards || [];
    tabContent = `
      <div class="rules-results cards-list-rules">
        ${intentionCards.length ? intentionCards.map(intention => `
          <div class="rules-card-entry intention-entry-card">
            <div class="card-entry-header">
              <span class="card-entry-cost">${escapeHtml(intention.id)}</span>
              <strong class="card-entry-name">${escapeHtml(intention.name)}</strong>
            </div>
            <div style="margin-top: 8px; display: grid; gap: 6px;">
              <p class="card-entry-text">👤 <strong>Comuns:</strong> ${escapeHtml(intention.commonText)} <code class="target-code">(${escapeHtml(intention.commonTarget)})</code></p>
              <p class="card-entry-text">👹 <strong>Brutais:</strong> ${escapeHtml(intention.brutalText)} <code class="target-code">(${escapeHtml(intention.brutalTarget)})</code></p>
            </div>
            <p class="card-entry-subtitle" style="margin-top: 10px;"><em>🧠 Estratégia: ${escapeHtml(intention.design || "")}</em></p>
          </div>
        `).join("") : `<p class="muted">Nenhuma intenção disponível no momento.</p>`}
      </div>
    `;
  } else if (isTraps) {
    const trapCards = local.trapCards || [];
    tabContent = `
      <div class="rules-results cards-list-rules">
        ${trapCards.length ? trapCards.map(trap => `
          <div class="rules-card-entry trap-entry-card">
            <div class="card-entry-header">
              <span class="card-entry-cost">${escapeHtml(trap.id)}</span>
              <strong class="card-entry-name">${escapeHtml(trap.name)}</strong>
              <span class="card-entry-type badge-danger">Armadilha</span>
            </div>
            <p class="card-entry-text" style="margin-top: 8px;">🕸️ <strong>Efeito:</strong> ${escapeHtml(trap.text)}</p>
          </div>
        `).join("") : `<p class="muted">Nenhuma armadilha disponível no momento.</p>`}
      </div>
    `;
  }

  return `
    <div class="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rulesTitle">
      <div class="rules-panel glass-panel">
        <div class="rules-header">
          <div>
            <span class="eyebrow">Manual do Jogo</span>
            <h2 id="rulesTitle">Regras e Biblioteca</h2>
          </div>
          <div class="rules-actions" style="display: flex; gap: 10px; align-items: center;">
            <button id="exportPdfBtn" class="primary" style="background: linear-gradient(135deg, #ffd785, #a8720a); color: #1a1000; font-weight: bold; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">🖨️ Exportar PDF</button>
            <button id="rulesClose" class="secondary" aria-label="Fechar regras">Fechar</button>
          </div>
        </div>
        
        <div class="rules-tabs" style="flex-wrap: wrap;">
          <button id="tabManual" class="tab-nav ${isManual ? "active" : ""}">Manual</button>
          <button id="tabGlossary" class="tab-nav ${isGlossary ? "active" : ""}">Glossário</button>
          <button id="tabCards" class="tab-nav ${isCards ? "active" : ""}">Cartas dos Heróis</button>
          <button id="tabRooms" class="tab-nav ${isRooms ? "active" : ""}">Cartas de Sala</button>
          <button id="tabIntentions" class="tab-nav ${isIntentions ? "active" : ""}">Cartas de Intenção</button>
          <button id="tabTraps" class="tab-nav ${isTraps ? "active" : ""}">Armadilhas</button>
        </div>
        
        <div class="rules-body">
          ${tabContent}
        </div>
      </div>
    </div>
  `;
}

function bindGlobalControls() {
  document.querySelectorAll("#leave").forEach(el => {
    el.addEventListener("click", () => {
      local.quitConfirmOpen = true;
      render();
    });
  });

  document.querySelector("#quitConfirmYes")?.addEventListener("click", () => {
    local.quitConfirmOpen = false;
    clearAuth();
  });

  document.querySelector("#quitConfirmNo")?.addEventListener("click", () => {
    local.quitConfirmOpen = false;
    render();
  });

  document.querySelector("#quit-confirm-overlay")?.addEventListener("click", (event) => {
    if (event.target.id === "quit-confirm-overlay") {
      local.quitConfirmOpen = false;
      render();
    }
  });

  document.querySelector("#rulesToggle")?.addEventListener("click", () => {
    local.rulesOpen = true;
    render();
    window.setTimeout(() => document.querySelector("#rulesSearch")?.focus(), 0);
  });
  document.querySelector("#rulesClose")?.addEventListener("click", () => {
    local.rulesOpen = false;
    render();
  });
  document.querySelector("#exportPdfBtn")?.addEventListener("click", exportToPDF);
  document.querySelector(".rules-modal")?.addEventListener("click", (event) => {
    if (event.target.classList.contains("rules-modal")) {
      local.rulesOpen = false;
      render();
    }
  });
  document.querySelector("#rulesSearch")?.addEventListener("input", (event) => {
    local.rulesQuery = event.target.value;
    render();
    const input = document.querySelector("#rulesSearch");
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
  
  // Tab switching listeners
  document.querySelector("#tabManual")?.addEventListener("click", () => {
    local.rulesTab = "manual";
    render();
  });
  document.querySelector("#tabGlossary")?.addEventListener("click", () => {
    local.rulesTab = "glossary";
    render();
    window.setTimeout(() => document.querySelector("#rulesSearch")?.focus(), 0);
  });
  document.querySelector("#tabCards")?.addEventListener("click", () => {
    local.rulesTab = "cards";
    render();
  });
  document.querySelector("#tabRooms")?.addEventListener("click", () => {
    local.rulesTab = "rooms";
    render();
  });
  document.querySelector("#tabIntentions")?.addEventListener("click", () => {
    local.rulesTab = "intentions";
    render();
  });
  document.querySelector("#tabTraps")?.addEventListener("click", () => {
    local.rulesTab = "traps";
    render();
  });
  
  // Hero tabs selection listeners
  document.querySelectorAll(".hero-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      local.rulesSelectedHero = btn.dataset.heroTab;
      render();
    });
  });
  
  // Energy allocation click listener
  document.querySelector("#confirmEnergyAlloc")?.addEventListener("click", () => {
    const fromId = document.querySelector("#energyAllocFrom")?.value;
    const toId = document.querySelector("#energyAllocTo")?.value;
    const amount = Number(document.querySelector("#energyAllocAmount")?.value || 1);
    if (!fromId || !toId) {
      showToast("Selecione os jogadores de origem e destino.", "warning");
      return;
    }
    if (fromId === toId) {
      showToast("A origem nao pode ser igual ao destino.", "warning");
      return;
    }
    action({ type: "confirmEnergyAllocation", allocation: { fromId, toId, amount } });
  });

  // Eco Arcano click listeners and selection updates
  const ecoSelect = document.querySelector("#ecoCardSelect");
  if (ecoSelect) {
    const updateEco = () => {
      const option = ecoSelect.options[ecoSelect.selectedIndex];
      if (!option) return;
      const cardId = option.value;
      const cardType = option.dataset.type;
      const cardTarget = option.dataset.target;
      const targetSelect = document.querySelector("#ecoTargetSelect");
      if (targetSelect) {
        targetSelect.innerHTML = "";
        const needsEnemy = cardType === "attack" && cardId !== "bola-de-fogo" && cardId !== "chuva-de-flechas" && cardId !== "explosao-divina";
        const needsAlly = cardTarget === "ally";
        if (needsEnemy) {
          local.state.enemies.filter(e => e.life > 0).forEach(e => {
            targetSelect.insertAdjacentHTML("beforeend", `<option value="${e.uid}">Inimigo: ${escapeHtml(e.name)}</option>`);
          });
        } else if (needsAlly) {
          local.state.players.filter(p => p.life > 0).forEach(p => {
            targetSelect.insertAdjacentHTML("beforeend", `<option value="${p.id}">Aliado: ${escapeHtml(p.name)}</option>`);
          });
        } else {
          targetSelect.insertAdjacentHTML("beforeend", `<option value="">Nao requer alvo</option>`);
        }
      }
    };
    ecoSelect.addEventListener("change", updateEco);
    updateEco();
  }
  document.querySelector("#confirmEco")?.addEventListener("click", () => {
    const cardId = document.querySelector("#ecoCardSelect")?.value;
    const targetId = document.querySelector("#ecoTargetSelect")?.value;
    action({ type: "confirmEcoArcano", copiedCardId: cardId, targetId });
  });
  document.querySelector("#cancelEco")?.addEventListener("click", () => {
    action({ type: "cancelEcoArcano" });
  });

  // Distorcao Temporal click listeners and selection updates
  const distSelect = document.querySelector("#distorcaoCardSelect");
  if (distSelect) {
    const updateDist = () => {
      const cardUid = distSelect.value;
      const me = getMe();
      const card = me?.hand.find(c => c.uid === cardUid);
      const targetSelect = document.querySelector("#distorcaoTargetSelect");
      if (card && targetSelect) {
        targetSelect.innerHTML = "";
        const needsEnemy = card.type === "attack" && card.id !== "bola-de-fogo" && card.id !== "chuva-de-flechas" && card.id !== "explosao-divina" && card.id !== "raio-congelante" && card.id !== "tempestade-eletrica";
        const needsAlly = card.target === "ally";
        if (needsEnemy) {
          local.state.enemies.filter(e => e.life > 0).forEach(e => {
            targetSelect.insertAdjacentHTML("beforeend", `<option value="${e.uid}">Inimigo: ${escapeHtml(e.name)}</option>`);
          });
        } else if (needsAlly) {
          local.state.players.filter(p => p.life > 0).forEach(p => {
            targetSelect.insertAdjacentHTML("beforeend", `<option value="${p.id}">Aliado: ${escapeHtml(p.name)}</option>`);
          });
        } else {
          targetSelect.insertAdjacentHTML("beforeend", `<option value="">Nao requer alvo</option>`);
        }
      }
    };
    distSelect.addEventListener("change", updateDist);
    updateDist();
  }
  document.querySelector("#confirmDistorcao")?.addEventListener("click", () => {
    const cardUid = document.querySelector("#distorcaoCardSelect")?.value;
    const targetId = document.querySelector("#distorcaoTargetSelect")?.value;
    action({ type: "playCard", cardUid, targetId });
  });
  document.querySelector("#skipDistorcao")?.addEventListener("click", () => {
    action({ type: "skipDistorcaoTemporal" });
  });

  // Espelho Arcano click listener
  document.querySelector("#confirmEspelhoArcano")?.addEventListener("click", () => {
    const targetEnemyUid = document.querySelector("#espelhoArcanoTargetSelect")?.value;
    action({ type: "confirmEspelhoArcano", targetEnemyUid });
  });

  // Amplificar click listeners
  document.querySelector("#confirmAmplificar")?.addEventListener("click", () => {
    const selectEl = document.querySelector("#ampCardSelect");
    const option = selectEl?.options[selectEl.selectedIndex];
    if (option) {
      const cardId = option.getAttribute("data-card-id");
      const targetId = option.getAttribute("data-target-id");
      action({ type: "confirmAmplificar", copiedCardId: cardId, targetId });
    }
  });
  document.querySelector("#cancelAmplificar")?.addEventListener("click", () => {
    action({ type: "cancelAmplificar" });
  });

  // Cataclismo Arcano click listener
  document.querySelector("#confirmCataclismoArcano")?.addEventListener("click", () => {
    const selectedEl = document.querySelector("input[name='cataclismoTerrainRadio']:checked");
    const terrainType = selectedEl ? selectedEl.value : null;
    action({ type: "confirmCataclismoArcano", terrainType });
  });

  // Tempestade Eletrica click listener
  document.querySelector("#confirmTempestadeEletrica")?.addEventListener("click", () => {
    const targetId = document.querySelector("#tempestadeEletricaTargetSelect")?.value;
    action({ type: "confirmTempestadeEletrica", targetId });
  });
}

function renderBossSelection() {
  const state = local.state;
  const options = state.bossSelectOptions || [];

  app.innerHTML = `
    <section class="boss-selection-screen">
      <div class="boss-selection-container glass-panel">
        <span class="eyebrow text-center">Fase Final - Sala 4</span>
        <h1 class="boss-select-title">Escolha o seu Destino</h1>
        <p class="boss-select-subtitle">Vocês sobreviveram até aqui. Agora, escolham o Chefe que irão enfrentar na sala final.</p>

        <div class="boss-cards-grid">
          ${options.map(boss => `
            <div class="boss-card-choice glass-panel" data-boss-id="${boss.id}">
              <div class="boss-card-header">
                <h2>${escapeHtml(boss.name)}</h2>
                <span class="boss-title">${escapeHtml(boss.title || "")}</span>
              </div>
              <div class="boss-stats-row">
                <div class="boss-stat">
                  <span class="stat-label">Vida</span>
                  <span class="stat-value life">${boss.maxLife} HP</span>
                </div>
                <div class="boss-stat">
                  <span class="stat-label">Escudo</span>
                  <span class="stat-value shield">${boss.shield}</span>
                </div>
                <div class="boss-stat">
                  <span class="stat-label">Ataque</span>
                  <span class="stat-value attack">${boss.attack}</span>
                </div>
              </div>
              <div class="boss-description-box">
                <p class="boss-desc-text">${escapeHtml(boss.description || "")}</p>
                <div class="boss-mechanics">
                  <strong>Mecânica:</strong>
                  <ul>
                    ${boss.id === "inquisidor" ? `
                      <li><strong>Fase 1:</strong> Pune uso de cartas de Defesa com 2 de dano.</li>
                      <li><strong>Fase 2 (50% HP):</strong> Destrói escudos dos heróis e todos os seus ataques passam a ignorar Escudo.</li>
                    ` : ""}
                    ${boss.id === "bruxa" ? `
                      <li><strong>Maldição do Relógio:</strong> Relógio começa em 5 e decrementa a cada rodada. Chegando a 0, causa 7 de dano a todos.</li>
                      <li><strong>Fase 2 (50% HP):</strong> Relógio cai para 1, invoca Bruxa do Breu e Místico Penumbra, e aplica Vácuo a todos.</li>
                    ` : ""}
                    ${boss.id === "colosso" ? `
                      <li><strong>Fase 1:</strong> Regenera +3 de Escudo no início da fase da masmorra.</li>
                      <li><strong>Fase 2 (50% HP):</strong> Causa 8 de dano a todos, entra em fúria (+15 ATK) e realiza um segundo ataque imediato de 5 de dano.</li>
                    ` : ""}
                    ${boss.id === "oraculo" ? `
                      <li><strong>Fase 1:</strong> Regenera +4 de Vida no início do turno da masmorra.</li>
                      <li><strong>Fase 2 (50% HP):</strong> Cura 20 HP de transição, envenena todos e rouba a cura recebida pelos heróis.</li>
                    ` : ""}
                  </ul>
                </div>
              </div>
              <button class="btn btn-primary select-boss-btn" data-boss="${boss.id}">Confrontar</button>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;

  document.querySelectorAll(".select-boss-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      action({ type: "selectBoss", bossId: btn.dataset.boss });
    });
  });
}

function renderEndGame() {
  const state = local.state;
  const isVictory = state.status === "victory";

  let totalDmgDealt = 0;
  let totalDmgTaken = 0;
  let totalHeal = 0;
  let totalCards = 0;

  state.players.forEach(p => {
    totalDmgDealt += p.roundStats?.damageDealt || 0;
    totalDmgTaken += p.roundStats?.damageTaken || 0;
    totalHeal += p.roundStats?.healingReceived || 0;
    totalCards += p.roundStats?.cardsPlayed || 0;
  });

  app.innerHTML = `
    <section class="endgame-screen ${isVictory ? "victory" : "defeat"}">
      <div class="endgame-container glass-panel animate-fade-in">
        <div class="endgame-header">
          <div class="result-badge">${isVictory ? "🏆 Vitória" : "💀 Derrota"}</div>
          <h1>${isVictory ? "Masmorra Concluída!" : "Seu grupo sucumbiu..."}</h1>
          <p class="endgame-subtitle">
            ${isVictory 
              ? "Vocês derrotaram o Chefe Final e conquistaram a glória eterna!" 
              : "As profundezas da masmorra reclamaram mais algumas almas. Tente novamente!"
            }
          </p>
        </div>

        <div class="match-summary-box">
          <h3>Resumo da Partida</h3>
          <div class="global-stats-row">
            <div class="global-stat-item">
              <span class="gstat-label">Rodadas Totais</span>
              <span class="gstat-value">${state.round || 1}</span>
            </div>
            <div class="global-stat-item">
              <span class="gstat-label">Dano Causado</span>
              <span class="gstat-value">${totalDmgDealt}</span>
            </div>
            <div class="global-stat-item">
              <span class="gstat-label">Dano Sofrido</span>
              <span class="gstat-value">${totalDmgTaken}</span>
            </div>
            <div class="global-stat-item">
              <span class="gstat-label">Cura Recebida</span>
              <span class="gstat-value">${totalHeal}</span>
            </div>
          </div>

          <div class="heroes-summary-list">
            <h4>Estatísticas dos Heróis</h4>
            <div class="heroes-stats-grid">
              ${state.players.map(p => `
                <div class="hero-stat-card glass-panel">
                  <div class="hcard-header">
                    <h5>${escapeHtml(p.name)}</h5>
                    <span class="hero-tag">${escapeHtml(p.heroName || "Sem heroi")}</span>
                  </div>
                  <div class="hcard-body">
                    <div class="hcard-row">
                      <span>Dano causado:</span>
                      <strong>${p.roundStats?.damageDealt || 0}</strong>
                    </div>
                    <div class="hcard-row">
                      <span>Dano recebido:</span>
                      <strong>${p.roundStats?.damageTaken || 0}</strong>
                    </div>
                    <div class="hcard-row">
                      <span>Cura recebida:</span>
                      <strong>${p.roundStats?.healingReceived || 0}</strong>
                    </div>
                    <div class="hcard-row">
                      <span>Cartas jogadas:</span>
                      <strong>${p.roundStats?.cardsPlayed || 0}</strong>
                    </div>
                    <div class="hcard-row">
                      <span>Inimigos derrotados:</span>
                      <strong>${p.roundStats?.enemiesDefeated || 0}</strong>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="endgame-actions">
          <button id="rematchBtn" class="btn btn-primary btn-lg">Jogar Novamente</button>
        </div>
      </div>
    </section>
  `;

  document.querySelector("#rematchBtn").addEventListener("click", () => {
    action({ type: "rematch" });
  });
}

function render() {
  const isGameScreen = local.state?.status === "playing" || local.animRunning;
  document.body.classList.toggle("is-game-screen", Boolean(isGameScreen));

  if (!local.sessionId || !local.playerId || !local.token) {
    renderHome();
    return;
  }

  if (!local.state) {
    app.innerHTML = `<section class="home"><div class="glass-panel loading"><h1>Conectando...</h1></div></section>`;
    connectEvents();
    return;
  }

  if (local.state.status === "lobby") {
    renderLobby();
  } else if (local.state.status === "boss_selection") {
    renderBossSelection();
  } else if ((local.state.status === "victory" || local.state.status === "defeat") && !local.animRunning) {
    renderEndGame();
  } else {
    renderGame();
  }

  app.insertAdjacentHTML("beforeend", renderRulesModal());
  app.insertAdjacentHTML("beforeend", renderToast());
  app.insertAdjacentHTML("beforeend", renderQuitConfirmModal());
  bindGlobalControls();
}

render();

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" || event.key === "Esc") {
    if (local.rulesOpen) {
      local.rulesOpen = false;
      render();
      return;
    }
    if (local.selectedCardUid) {
      local.selectedCardUid = "";
      render();
      return;
    }
    if (local.sessionId) {
      local.quitConfirmOpen = !local.quitConfirmOpen;
      render();
    }
  }
});

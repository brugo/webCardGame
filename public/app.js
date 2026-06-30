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
  previousMeters: {},
  roomCards: [],
  trapCards: [],
  intentionCards: [],
  heroes: [],
  heroCards: {}
};

const cardArt = "/assets/hero-card-example.png";
const enemyArt = "/assets/enemy-card-example.png";
const trapArts = ["/assets/trap-card-1.png", "/assets/trap-card-2.png"];

function getCardArt(card) {
  if (card) {
    if (card.heroId === "guardiao") return "/assets/guardiao-card.jpg";
    if (card.heroId === "batedor") return "/assets/batedor-card.jpg";
    if (card.heroId === "mago") return "/assets/mago-card.jpg";
  }
  return cardArt;
}

function getHeroCardArt(heroId) {
  if (heroId === "guardiao") return "/assets/guardiao-card.jpg";
  if (heroId === "batedor") return "/assets/batedor-card.jpg";
  if (heroId === "mago") return "/assets/mago-card.jpg";
  return "/assets/hero-card-example.png";
}

function getEnemyArt(enemy) {
  if (enemy) {
    if (enemy.id === "sentinela") return "/assets/sentinela-oco.jpg";
    if (enemy.id === "salteador") return "/assets/salteador-cinzento.jpg";
    if (enemy.id === "bruxa") return "/assets/bruxa-do-breu.jpg";
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
  ["Energia", "Recurso usado para jogar cartas. Cada heroi inicia o turno com sua Energia maxima (Guardiao: 4, Oraculo: 5, Batedor: 4, Arcanista: 6). Ela e restaurada a cada rodada e nao acumula."],
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
  local.previousMeters = {};
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

function setState(nextState) {
  local.previousMeters = collectMeterValues(local.state);
  local.state = nextState;
  ingestVisualEvents(nextState);
  render();
}

function ingestVisualEvents(state) {
  (state?.visualEvents || []).forEach((event) => {
    if (!event.id || local.seenVisualEventIds.has(event.id)) return;
    local.seenVisualEventIds.add(event.id);

    // Delay of 1.5 seconds (1500ms) before the animation triggers
    window.setTimeout(() => {
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
          ${renderSummaryCard(state)}
          <div class="glass-panel compact-panel">
            <span class="eyebrow">Controle de turno</span>
            ${renderTurnControls(state, me)}
            <p class="notice">${escapeHtml(local.error)}</p>
          </div>
          ${renderGameStatusPanel(state, me)}
          ${renderRoomCard(state)}
          ${renderTrapCard(state.activeTrap, state.activeTrapDisabledRounds)}
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
      ${renderShieldAllocationModal(state, me)}
      ${renderEnergyAllocationModal(state, me)}
      ${renderEcoArcanoModal(state, me)}
      ${renderDistorcaoTemporalModal(state, me)}
      ${renderRewardSelectionModal(state, me)}
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
  document.querySelectorAll("[data-reaction-card]").forEach((button) => {
    button.addEventListener("click", () => action({ type: "playReaction", cardUid: button.dataset.reactionCard }));
  });
  document.querySelector("#useSupreme")?.addEventListener("click", () => action({ type: "useSupreme" }));
  document.querySelector("#buyCard")?.addEventListener("click", () => action({ type: "buyCard" }));
  // pending discard: clicking a card in discard-mode selects it for discard
  document.querySelectorAll("[data-discard-card]").forEach((el) => {
    el.addEventListener("click", () => action({ type: "discardCard", cardUid: el.dataset.discardCard }));
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
  const card = me?.hand.find((candidate) => candidate.uid === local.selectedCardUid);
  if (!card) {
    showToast("Carta nao encontrada na mao.");
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
  if (me.energy < card.cost) {
    showToast("Energia insuficiente.");
    return;
  }
  const button = document.querySelector("#playSelectedCard");
  button.disabled = true;
  window.setTimeout(() => {
    const target = document.querySelector("#selectedCardTarget");
    const fromTarget = document.querySelector("#selectedCardFrom");
    const amountInput = document.querySelector("#shieldMoveAmount");
    action({
      type: "playCard",
      cardUid: card.uid,
      targetId: target?.value,
      fromId: fromTarget?.value,
      shieldAmount: amountInput ? Number(amountInput.value) : undefined
    });
  }, 120);
}

function renderReactionPrompt(state, me) {
  const pending = state.pendingReaction;
  if (!pending) return "";

  const isEligible = pending.eligiblePlayerIds.includes(me.id) && !pending.skippedPlayerIds.includes(me.id);
  const reactionCards = me.hand.filter((card) => card.type === "reaction");

  return `
    <section class="reaction-window" role="dialog" aria-modal="true" aria-labelledby="reactionTitle">
      <div class="reaction-panel glass-panel">
        <span class="eyebrow">Janela de reacao</span>
        <h2 id="reactionTitle">${escapeHtml(pending.enemyName)} vai atacar ${escapeHtml(pending.targetName)}</h2>
        <p>${escapeHtml(pending.ruleText)} Dano previsto: ${pending.attack}.</p>
        ${
          isEligible
            ? `
              <div class="reaction-cards">
                ${reactionCards
                  .map(
                    (card) => `
                      <article class="tcg-card reaction-choice ${me.energy < card.cost ? "unplayable" : ""}">
                        <div class="card-cost">${card.cost}</div>
                        <img src="${getCardArt(card)}" alt="" />
                        <div class="card-body">
                          <strong>${escapeHtml(card.name)}</strong>
                          <p>${escapeHtml(card.text)}</p>
                          ${renderCardTags(card)}
                        </div>
                        <button data-reaction-card="${card.uid}" ${me.energy < card.cost ? "disabled" : ""}>Usar reacao</button>
                      </article>
                    `
                  )
                  .join("")}
              </div>
              <button id="skipReaction" class="secondary">Nao reagir desta vez</button>
            `
            : `<p class="muted">Aguardando jogadores com cartas de reacao decidirem.</p>`
        }
      </div>
    </section>
  `;
}

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
        <div>
          <span class="eyebrow">Mao</span>
          <strong>${me.hand.length}</strong>
        </div>
        <div class="resource-strip">
          ${renderEnergyPips(me.energy, me.maxEnergy)}
        </div>
        <button id="buyCard" class="buy-card-btn" ${state.turn !== 'players' || me.turnEnded || me.energy < 1 || me.hand.length >= (me.maxHandSize || 5) ? 'disabled' : ''}>
          🎴 Comprar (1⚡)
        </button>
        ${hasSupreme ? `
          <div class="supreme-container">
            <button id="useSupreme" class="supreme-btn" ${state.turn !== 'players' || me.turnEnded ? 'disabled' : ''}>
              ✨ Suprema
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
          <div class="supreme-container" style="margin-top: 6px;">
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
  const card = me.hand.find((candidate) => candidate.uid === local.selectedCardUid);
  if (!card) return "";

  const canTargetMonster = (card.type === "attack" && !card.areaDamage) || card.target === "enemy" || card.enemyChallenge;
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

  const blocked = state.turn !== "players" || me.turnEnded || me.energy < card.cost || card.type === "reaction";

  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="selectedCardName">
      <article class="tcg-card selected-card-detail ${card.type}">
        <button id="closeCardDetail" class="card-close secondary" aria-label="Fechar carta">Fechar</button>
        <div class="card-cost">${card.cost}</div>
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
    return `
      <p class="muted">A dungeon esta aguardando uma janela de reacao antes de resolver o ataque.</p>
    `;
  }

  if (state.turn === "players") {
    return `
      <p class="muted">Quando todos finalizarem, a dungeon resolve a carta de intencao automaticamente.</p>
      <button id="endTurn" class="danger" ${me.turnEnded ? "disabled" : ""}>
        ${me.turnEnded ? "Turno finalizado" : "Finalizar turno"}
      </button>
    `;
  }

  if (state.roomComplete) {
    if (!me.hasClaimedRoomReward) {
      return `
        <p class="muted">Sala concluida! Escolha sua recompensa antes de prosseguir.</p>
        <button id="claimRewardBtn" style="background: linear-gradient(135deg, #ffd785, #a8720a); color: #1a1000; font-weight: 900; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; box-shadow: 0 0 15px rgba(245, 194, 0, 0.4);">
          🎁 Receber Recompensas
        </button>
      `;
    }
    if (!state.allRewardsClaimed) {
      return `
        <p class="muted">Voce ja escolheu sua recompensa. Aguardando os aliados escolherem...</p>
        <button disabled class="secondary" style="opacity: 0.6; cursor: not-allowed;">Aguardando Grupo...</button>
      `;
    }
  }

  return `
    <p class="muted">A dungeon atacou seguindo a intencao ativa. Inicie a proxima rodada para revelar uma nova carta.</p>
    <button id="startNextRound">${state.roomComplete ? "Avancar para proxima sala" : "Iniciar proxima rodada"}</button>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar game-topbar">
      <div class="brand">
        <span class="eyebrow">Online cooperative TCG</span>
        <h1>Arena Cooperativa</h1>
        <p>Sala ${escapeHtml(local.sessionId)} | intencoes, custos e dano validados pelo servidor</p>
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

function getTrapArt(trap) {
  const number = Number(String(trap?.id || "").replace(/\D/g, ""));
  return trapArts[number % trapArts.length];
}

function renderIntentionCard(intention) {
  if (!intention) {
    return `
      <article class="intention-card glass-panel">
        <span class="eyebrow">Intencao</span>
        <div class="intention-art empty-art"></div>
        <h2>Aguardando carta</h2>
      </article>
    `;
  }

  return `
    <article class="intention-card glass-panel new-intention-v2">
      <span class="eyebrow">Carta de intencao</span>
      <div class="intention-header">
        <span class="card-number">${escapeHtml(intention.id)}</span>
        <h2>${escapeHtml(intention.name)}</h2>
      </div>
      <div class="intention-rules-v2">
        <div class="section-v2 presagio-v2">
          <div class="label-v2">⚡ Presságio</div>
          <p>${escapeHtml(intention.presagioText)}</p>
        </div>
        <div class="section-v2 comum-v2">
          <div class="label-v2">👤 Comuns atacam</div>
          <p>${escapeHtml(intention.commonText)}</p>
        </div>
        <div class="section-v2 brutal-v2">
          <div class="label-v2">👹 Brutal ataca</div>
          <p>${escapeHtml(intention.brutalText)}</p>
        </div>
        <div class="section-v2 represalia-v2">
          <div class="label-v2">💀 Represália</div>
          <p>${escapeHtml(intention.represaliaText)}</p>
        </div>
      </div>
    </article>
  `;
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

  let intentionText = "Nenhuma intenção revelada.";
  if (state.activeIntention) {
    intentionText = `
      <div class="summary-rules-v2">
        <div class="summary-section-v2 presagio-sum">⚡ <strong>Presságio:</strong> ${escapeHtml(state.activeIntention.presagioText)}</div>
        <div class="summary-section-v2 comum-sum">👤 <strong>Comuns:</strong> ${escapeHtml(state.activeIntention.commonText)}</div>
        <div class="summary-section-v2 brutal-sum">👹 <strong>Brutais:</strong> ${escapeHtml(state.activeIntention.brutalText)}</div>
        <div class="summary-section-v2 represalia-sum">💀 <strong>Represália:</strong> ${escapeHtml(state.activeIntention.represaliaText)}</div>
      </div>
    `;
  }

  return `
    <article class="summary-card glass-panel">
      <span class="eyebrow">Resumo do Combate</span>
      
      <div class="summary-section summary-intention">
        <h3>Intenções dos Inimigos</h3>
        <div class="summary-content">${intentionText}</div>
      </div>

      <div class="summary-section summary-trap">
        <h3>Armadilha Ativa</h3>
        <div class="summary-content">${trapText}</div>
      </div>

      <div class="summary-section summary-room">
        <h3>Regras da Sala</h3>
        <div class="summary-content">${escapeHtml(roomRule)}</div>
      </div>
    </article>
  `;
}

function renderPlayerHud(player) {
  const hasResources = local.state?.status === "playing" && Number.isFinite(player.maxLife) && Number.isFinite(player.maxEnergy);
  return `
    <article id="hud-player-${player.id}" class="player-hud hero-${player.heroId || "none"} ${player.id === local.playerId ? "is-you" : ""} ${player.turnEnded ? "turn-ended" : ""}">
      <div class="portrait">
        <img src="${player.heroId === 'guardiao' ? '/assets/guardiao-card.jpg' : player.heroId === 'batedor' ? '/assets/batedor-card.jpg' : player.heroId === 'mago' ? '/assets/mago-card.jpg' : cardArt}" alt="" />
      </div>
      <div class="hud-main">
        <div class="hud-title">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${escapeHtml(player.heroName || "Sem heroi")} ${player.turnEnded ? "| finalizou" : player.ready ? "| pronto" : ""}</span>
        </div>
        ${
          hasResources
            ? `
              ${renderPlayerMeter("life", player.life || 0, player.maxLife || 1, "Vida", `hero-${player.id}-life`)}
              ${renderPlayerMeter("energy", player.energy || 0, player.maxEnergy || 1, "Energia", `hero-${player.id}-energy`)}
              <div class="hud-stats">
                <span class="hero-shield shield-badge"><i></i>${player.shield || 0}</span>
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
        <img src="${hero.id === 'guardiao' ? '/assets/guardiao-card.jpg' : hero.id === 'batedor' ? '/assets/batedor-card.jpg' : hero.id === 'mago' ? '/assets/mago-card.jpg' : cardArt}" alt="" />
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
  const defeated = enemy.life <= 0;
  return `
    <article id="card-enemy-${enemy.uid}" class="monster-card ${enemy.category} ${defeated ? "defeated" : ""}">
      <div class="monster-art">
        <img src="${getEnemyArt(enemy)}" alt="" />
      </div>
      <div class="monster-info">
        <span>${escapeHtml(enemy.role)}</span>
        <strong>${escapeHtml(enemy.name)}</strong>
      </div>
      ${renderMeter("life", enemy.life, enemy.maxLife, "Vida", `enemy-${enemy.uid}-life`)}
      <div class="monster-footer">
        <span>Ataque ${enemy.attack}</span>
        <span class="shield-badge"><i></i>${enemy.shield}</span>
        <span>${enemy.life}/${enemy.maxLife}</span>
      </div>
    </article>
  `;
}

function renderHandCard(card, state, index = 0, total = 1) {
  const me = getMe();
  const blocked = state.turn !== "players" || me.turnEnded || me.energy < card.cost;
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
      <div class="card-cost">${card.cost}</div>
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
              <div class="card-cost">${card.cost}</div>
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

function renderRewardSelectionModal(state, me) {
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
  const alloc = state?.pendingEcoArcano;
  if (!alloc || alloc.casterId !== me?.id) return "";
  
  const played = me.played || [];
  const eligible = played.filter(c => c.id !== "eco-arcano" && c.id !== "cataclismo-arcano");
  
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
  const alloc = state?.pendingDistorcaoTemporal;
  if (!alloc || alloc.targetId !== me?.id) return "";
  
  const caster = state.players.find(p => p.id === alloc.casterId);
  const eligible = me.hand.filter(c => c.cost <= 2 && c.type !== "reaction");
  
  return `
    <div class="card-lightbox" role="dialog" aria-modal="true" aria-labelledby="distorcaoTitle">
      <div class="glass-panel reaction-panel shield-alloc-modal" style="max-width: 480px;">
        <span class="eyebrow">Distorcao Temporal</span>
        <h2 id="distorcaoTitle">Conjuracao Temporal</h2>
        <p class="muted">${escapeHtml(caster ? caster.name : "Mago")} lhe concedeu uma acao extra. Escolha uma carta de custo 2 ou menos para jogar gratuitamente.</p>
        
        ${eligible.length === 0 ? `
          <p class="muted" style="margin: 16px 0; text-align: center;">Você não possui cartas de custo 2 ou menos na mão.</p>
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
      <li><strong>Guardião Solar (32 Vida, 4 Energia):</strong> Focado em escudos, redução de dano e reações para interceptar golpes e proteger os aliados.</li>
      <li><strong>Oráculo Lunar (24 Vida, 5 Energia):</strong> Especialista em curar o grupo, redistribuir escudos e conceder energia/cartas adicionais.</li>
      <li><strong>Batedor Verde (28 Vida, 4 Energia):</strong> Focado em causar dano físico de precisão, tiros rápidos e perfurar escudos.</li>
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
      <li><strong>Ordem de Turno / Lobby:</strong> Se o empate persistir, o monstro ataca conforme a ordem do lobby (Guardião &rarr; Oráculo &rarr; Batedor &rarr; Mago).</li>
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
            <li><strong>Guardião Solar (32 Vida, 4 Energia):</strong> Focado em escudos, redução de dano e reações para interceptar golpes e proteger os aliados.</li>
            <li><strong>Oráculo Lunar (24 Vida, 5 Energia):</strong> Especialista em curar o grupo, redistribuir escudos e conceder energia/cartas adicionais.</li>
            <li><strong>Batedor Verde (28 Vida, 4 Energia):</strong> Focado em causar dano físico de precisão, tiros rápidos e perfurar escudos.</li>
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
            <li><strong>4º Critério:</strong> Em caso de empate absoluto, o monstro ataca de acordo com a ordem do lobby (Guardião &rarr; Oráculo &rarr; Batedor &rarr; Mago).</li>
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
                <span class="card-entry-cost">${card.cost}⚡</span>
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
  document.querySelector("#leave")?.addEventListener("click", clearAuth);
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
}

function render() {
  const isGameScreen = local.state?.status === "playing";
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
  } else {
    renderGame();
  }

  app.insertAdjacentHTML("beforeend", renderRulesModal());
  app.insertAdjacentHTML("beforeend", renderToast());
  bindGlobalControls();
}

render();

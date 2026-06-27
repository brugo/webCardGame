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
  rulesTab: "glossary",
  rulesSelectedHero: "guardiao",
  state: null,
  events: null,
  justPlayedUid: "",
  selectedCardUid: "",
  seenVisualEventIds: new Set(),
  previousMeters: {}
};

const cardArt = "/assets/hero-card-example.png";
const enemyArt = "/assets/enemy-card-example.png";
const trapArts = ["/assets/trap-card-1.png", "/assets/trap-card-2.png"];

function getCardArt(card) {
  if (card) {
    if (card.heroId === "guardiao") return "/assets/guardiao-card.jpg";
    if (card.heroId === "batedor") return "/assets/batedor-card.jpg";
  }
  return cardArt;
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
  ["Energia", "Cada heroi inicia o turno com 3 de Energia. Ela retorna para 3 a cada turno e nao acumula."],
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
          ${renderGameStatusPanel(state, me)}
          ${renderRoomCard(state)}
          <div class="glass-panel compact-panel">
            <span class="eyebrow">Controle de turno</span>
            ${renderTurnControls(state, me)}
            <p class="notice">${escapeHtml(local.error)}</p>
          </div>
          ${renderTrapCard(state.activeTrap)}
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
        <button id="buyCard" class="buy-card-btn" ${state.turn !== 'players' || me.turnEnded || me.energy < 1 ? 'disabled' : ''}>
          🎴 Comprar (1⚡)
        </button>
        ${hasSupreme ? `
          <div class="supreme-container">
            <button id="useSupreme" class="supreme-btn" ${state.turn !== 'players' || me.turnEnded ? 'disabled' : ''}>
              ✨ ${escapeHtml(me.supremeCard.name)}
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
      <span class="eyebrow">Sala ${state.roomDeckCount !== undefined ? 10 - state.roomDeckCount : state.round} | Rodada ${state.roomRound}</span>
      <h2>${escapeHtml(room?.name || "Sala desconhecida")}</h2>
      <p>${escapeHtml(room?.subtitle || "")}</p>
      <div class="room-objective">${escapeHtml(room?.objective || "Derrote todos os inimigos.")}</div>
      <div class="room-rule">${escapeHtml(room?.rule || "")}</div>
      <div class="room-reward">${escapeHtml(room?.reward || "")}</div>
    </article>
  `;
}

function renderTrapCard(trap) {
  if (!trap) {
    return `
      <article class="trap-card glass-panel">
        <span class="eyebrow">Armadilha</span>
        <div class="trap-art"><img src="${trapArts[0]}" alt="" /></div>
        <h2>Aguardando armadilha</h2>
      </article>
    `;
  }

  return `
    <article class="trap-card glass-panel">
      <span class="eyebrow">Armadilha ativa</span>
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
    <article class="intention-card glass-panel">
      <span class="eyebrow">Carta de intencao</span>
      <div class="intention-art">
        <span>${escapeHtml(intention.id)}</span>
      </div>
      <h2>${escapeHtml(intention.name)}</h2>
      <div class="intention-rules">
        <p><strong>Comuns</strong>${escapeHtml(intention.commonText)}</p>
        <p><strong>Brutais</strong>${escapeHtml(intention.brutalText)}</p>
      </div>
    </article>
  `;
}

function renderPlayerHud(player) {
  const hasResources = local.state?.status === "playing" && Number.isFinite(player.maxLife) && Number.isFinite(player.maxEnergy);
  return `
    <article id="hud-player-${player.id}" class="player-hud hero-${player.heroId || "none"} ${player.id === local.playerId ? "is-you" : ""} ${player.turnEnded ? "turn-ended" : ""}">
      <div class="portrait">
        <img src="${player.heroId === 'guardiao' ? '/assets/guardiao-card.jpg' : player.heroId === 'batedor' ? '/assets/batedor-card.jpg' : cardArt}" alt="" />
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
        <img src="${hero.id === 'guardiao' ? '/assets/guardiao-card.jpg' : hero.id === 'batedor' ? '/assets/batedor-card.jpg' : cardArt}" alt="" />
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
        <img src="${enemyArt}" alt="" />
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

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function renderRulesModal() {
  if (!local.rulesOpen) return "";
  
  const isGlossary = local.rulesTab === "glossary";
  const isCards = local.rulesTab === "cards";
  
  const query = normalizeSearch(local.rulesQuery);
  const entries = glossaryEntries.filter(([term, description]) =>
    normalizeSearch(`${term} ${description}`).includes(query)
  );
  
  let tabContent = "";
  if (isGlossary) {
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
    const state = local.state;
    const heroesList = state?.heroes || [];
    const heroCardsMap = state?.heroCards || {};
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
        }).join("") : `<p class="muted">Nenhum dado de carta disponível. Conecte-se a uma partida primeiro.</p>`}
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
          <button id="rulesClose" class="secondary" aria-label="Fechar regras">Fechar</button>
        </div>
        
        <div class="rules-tabs">
          <button id="tabGlossary" class="tab-nav ${isGlossary ? "active" : ""}">Glossário</button>
          <button id="tabCards" class="tab-nav ${isCards ? "active" : ""}">Cartas dos Heróis</button>
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
  document.querySelector("#tabGlossary")?.addEventListener("click", () => {
    local.rulesTab = "glossary";
    render();
    window.setTimeout(() => document.querySelector("#rulesSearch")?.focus(), 0);
  });
  document.querySelector("#tabCards")?.addEventListener("click", () => {
    local.rulesTab = "cards";
    render();
  });
  
  // Hero tabs selection listeners
  document.querySelectorAll(".hero-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      local.rulesSelectedHero = btn.dataset.heroTab;
      render();
    });
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

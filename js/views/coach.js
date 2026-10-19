/* =========================================================================
   views/coach.js — chat with the offline rule-based assistant
   ========================================================================= */

import { esc, icon, hydrateIcons, md, dateKey } from '../utils.js';
import { toast, modal, closeModal } from '../ui.js';
import { respond, briefing, CHIPS, pushMessage, chatHistory, clearChat } from '../coach.js';
import { store } from '../store.js';

let pendingRender = false;

export function render(root) {
  const history = chatHistory();

  root.innerHTML = `
    <div class="stack-lg" style="padding-bottom:8px">
      <!-- Header -->
      <div class="row between wrap" style="gap:10px">
        <div>
          <div class="eyebrow">Offline assistant · reads your data, keeps your secrets</div>
          <div class="h-hero">Coach</div>
        </div>
        <div class="chip-row">
          <button class="chip" data-act="clear">${icon('trash', 'sm')} Clear chat</button>
        </div>
      </div>

      <!-- Chat -->
      <div class="card pad-lg chat" id="chat" style="min-height:280px;max-height:calc(100dvh - 300px);overflow-y:auto">
        ${history.length ? history.map(msgHTML).join('') : introHTML()}
      </div>

      <!-- Chips -->
      <div class="chip-row" id="chips">
        ${CHIPS.map(c => `<button class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>

      <!-- Composer -->
      <div class="card chat-composer" style="position:sticky;bottom:calc(var(--tabbar-h) + 8px);z-index:20">
        <textarea class="input" id="chat-in" rows="1"
          placeholder="Ask about today's plan, calories, balance, motivation…"
          style="flex:1;resize:none;max-height:120px"></textarea>
        <button class="btn btn-primary" id="chat-send" style="height:48px;width:48px;padding:0" aria-label="Send">${icon('chat')}</button>
      </div>
    </div>`;

  hydrateIcons(root);
  bind(root);
  scrollChat(root);

  // Auto-ask whatever the dashboard chips handed us
  const pending = sessionStorage.getItem('momentum.pendingAsk');
  if (pending) {
    sessionStorage.removeItem('momentum.pendingAsk');
    ask(root, pending);
  }
}

function introHTML() {
  const b = briefing();
  return `
    <div class="msg coach">
      ${md(`${b.head}\n\nI run entirely on this device — no account, no cloud, no key needed. I can see your plan, your calories, your work hours and your streaks.\n\nTry one of the chips below, or type freely.`)}
    </div>`;
}

function msgHTML(m) {
  const role = m.role === 'user' ? 'user' : 'coach';
  const actions = (m.actions || []).length
    ? `<div class="chip-row" style="margin-top:9px">${m.actions.map(a => `<button class="chip" data-goto="${a.hash}">${esc(a.label)}</button>`).join('')}</div>` : '';
  const chips = (m.chips || []).length
    ? `<div class="chip-row" style="margin-top:9px">${m.chips.map(c => `<button class="chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
  return `<div class="msg ${role}">${md(m.text)}${actions}${chips}</div>`;
}

/** Rebuild the whole thread from history so store re-renders never lose buttons. */
function paintChat(root) {
  const chat = root.querySelector('#chat');
  if (!chat) return;
  const history = chatHistory();
  chat.innerHTML = history.length ? history.map(msgHTML).join('') : introHTML();
  hydrateIcons(chat);
  scrollChat(root);
}

function scrollChat(root) {
  const chat = root.querySelector('#chat');
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function ask(root, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  pushMessage('user', trimmed);
  paintChat(root);

  const input = root.querySelector('#chat-in');
  if (input) { input.value = ''; input.style.height = 'auto'; }

  // thinking beat — keeps it feeling deliberate, not robotic
  const chat = root.querySelector('#chat');
  const typing = document.createElement('div');
  typing.className = 'msg coach';
  typing.innerHTML = `<span class="muted">thinking…</span>`;
  chat.appendChild(typing);
  scrollChat(root);

  setTimeout(() => {
    const res = respond(trimmed);
    pushMessage('coach', res.text, { actions: res.actions, chips: res.chips });
    paintChat(root);          // includes the new reply + its action chips
  }, 260 + Math.random() * 260);
}

function bind(root) {
  const input = root.querySelector('#chat-in');

  root.querySelector('#chat-send').onclick = () => ask(root, input.value);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(root, input.value);
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  });

  root.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) return ask(root, chip.dataset.chip);

    const goto = e.target.closest('[data-goto]');
    if (goto) { e.preventDefault(); location.hash = goto.dataset.goto; return; }

    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'clear') {
      clearChat();
      render(root);
      toast('Chat cleared');
    }
  });
}

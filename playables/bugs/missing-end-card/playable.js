const events = [];
let score = 0;
let firstInteractionEmitted = false;

function emitEvent(name, payload = {}) {
  const event = { name, payload, timestamp: new Date().toISOString() };
  events.push(event);
  window.playableEvents = events;
  window.dispatchEvent(new CustomEvent("playable:event", { detail: event }));
  document.querySelector("[data-testid='event-log']").textContent = JSON.stringify(events);
}

function updateProgress() {
  document.querySelector("[data-testid='progress']").textContent = `Progress: ${score}/3`;
}

function handleCoinClick() {
  if (score >= 3) return;

  if (!firstInteractionEmitted) {
    firstInteractionEmitted = true;
    emitEvent("first_interaction", { method: "click" });
  }

  score += 1;
  updateProgress();
  emitEvent("progress", { score, target: 3 });
}

function handleCtaClick() {
  emitEvent("cta_clicked", { score });
}

window.playableEvents = events;
window.addEventListener("DOMContentLoaded", () => {
  document.querySelector("[data-testid='coin-button']").addEventListener("click", handleCoinClick);
  document.querySelector("[data-testid='cta-button']").addEventListener("click", handleCtaClick);
  emitEvent("playable_loaded");
});

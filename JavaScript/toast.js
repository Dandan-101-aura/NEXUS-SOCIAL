import { createIcon } from "./icons.js";

const TOAST_ICONS = Object.freeze({
  success: "check-circle",
  error: "alert",
  warning: "alert",
  info: "info",
});
const MAX_TOASTS = 4;
const activeByKey = new Map();

// message: texto simples (nunca HTML). type: success | error | warning | info.
// options.duration: milissegundos (0 = fica até o usuário fechar).
// options.key: identifica o aviso; mostrar outro com a mesma chave substitui o anterior.
export function showToast(message, type = "info", { duration, key } = {}) {
  const region = document.querySelector("#toast-region");
  if (!region) {
    return null;
  }
  if (key) {
    dismissToast(key);
  }

  const total = duration ?? (type === "error" ? 8000 : 4500);
  const toast = document.createElement("div");
  toast.className = `toast toast-${TOAST_ICONS[type] ? type : "info"}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const iconWrap = document.createElement("span");
  iconWrap.className = "toast-icon";
  iconWrap.append(createIcon(TOAST_ICONS[type] ?? "info"));

  const text = document.createElement("p");
  text.className = "toast-text";
  text.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", "Fechar notificação");
  closeButton.append(createIcon("x"));

  toast.append(iconWrap, text, closeButton);

  let progress = null;
  if (total > 0) {
    progress = document.createElement("span");
    progress.className = "toast-progress";
    progress.style.animationDuration = `${total}ms`;
    toast.append(progress);
  }

  let remaining = total;
  let startedAt = 0;
  let timer = null;
  let closed = false;

  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    clearTimeout(timer);
    if (key && activeByKey.get(key) === close) {
      activeByKey.delete(key);
    }
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  };
  const resume = () => {
    if (!total || closed || timer) {
      return;
    }
    startedAt = Date.now();
    timer = setTimeout(close, remaining);
    if (progress) {
      progress.style.animationPlayState = "running";
    }
  };
  const pause = () => {
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startedAt;
    if (progress) {
      progress.style.animationPlayState = "paused";
    }
  };

  closeButton.addEventListener("click", close);
  toast.addEventListener("mouseenter", pause);
  toast.addEventListener("mouseleave", resume);
  toast.addEventListener("focusin", pause);
  toast.addEventListener("focusout", resume);

  region.append(toast);
  while (region.children.length > MAX_TOASTS) {
    region.firstElementChild.remove();
  }
  if (key) {
    activeByKey.set(key, close);
  }
  resume();
  return close;
}

export function dismissToast(key) {
  activeByKey.get(key)?.();
}

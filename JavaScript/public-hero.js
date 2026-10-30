import { createIcon } from "./icons.js";

const ACTIONS = [
  { id: "register", label: "Cadastre um pedido fictício", icon: "plus-circle" },
  { id: "follow", label: "Acompanhe o atendimento", icon: "clock" },
  { id: "confirm", label: "Confirme o recebimento", icon: "check-circle" },
];

const SLOT_MS = 1750;
const ENTER_MS = 500;
const LEAVE_MS = 420;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - Math.pow(1 - value, 3);
const easeIn = (value) => Math.pow(value, 3);

export function initPublicHeroCycle(root = document) {
  const home = root.querySelector("#public-home");
  const hero = root.querySelector(".public-hero");
  const icon = root.querySelector("#public-action-cycle-icon");
  const copy = root.querySelector("#public-action-cycle-copy");
  if (!home || !hero || !icon || !copy) return;

  let activeIndex = -1;
  let frame = 0;
  let heroIsVisible = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const duration = SLOT_MS * ACTIONS.length;

  // One seekable WAAPI clock drives the copy, icon, and step color together.
  const clock = new Animation(
    new KeyframeEffect(null, [{ opacity: 0 }, { opacity: 0 }], {
      duration,
      iterations: Infinity,
    }),
    document.timeline,
  );

  function setAction(index) {
    if (activeIndex === index) return;
    activeIndex = index;
    const action = ACTIONS[index];
    home.dataset.actionStep = action.id;
    copy.textContent = action.label;
    icon.replaceChildren(createIcon(action.icon, "icon"));
  }

  function setFrame(opacity, enterProgress) {
    const inverse = 1 - opacity;
    copy.style.opacity = String(opacity);
    copy.style.transform = `translateY(${inverse * 0.32}em) scale(${0.96 + opacity * 0.04})`;
    copy.style.filter = `blur(${inverse * 8}px)`;
    icon.style.opacity = String(opacity);
    icon.style.transform = `translateY(${inverse * 0.32}em) scale(${0.7 + enterProgress * 0.3}) rotate(${inverse * -14}deg)`;
    icon.style.filter = `blur(${inverse * 8}px)`;
  }

  function pause() {
    if (clock.playState === "running") clock.pause();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick() {
    frame = 0;
    if (document.visibilityState !== "visible" || !heroIsVisible || reducedMotion.matches) {
      pause();
      if (reducedMotion.matches) {
        setAction(0);
        setFrame(1, 1);
      }
      return;
    }

    if (clock.playState !== "running") clock.play();
    const time = Number(clock.currentTime) || 0;
    const localTime = time % SLOT_MS;
    const index = Math.floor(time / SLOT_MS) % ACTIONS.length;
    setAction(index);

    const enterProgress = easeOut(clamp01(localTime / ENTER_MS));
    const leaveProgress = easeIn(clamp01((SLOT_MS - localTime) / LEAVE_MS));
    setFrame(Math.min(enterProgress, leaveProgress), enterProgress);
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  if (reducedMotion.matches) {
    setAction(0);
    setFrame(1, 1);
  } else {
    schedule();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
    else schedule();
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      heroIsVisible = entry.isIntersecting;
      if (heroIsVisible) schedule();
      else pause();
    });
    observer.observe(hero);
  }

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      pause();
      setAction(0);
      setFrame(1, 1);
    } else {
      clock.currentTime = 0;
      schedule();
    }
  });
}

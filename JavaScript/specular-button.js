const SPECULAR_BUTTON_SELECTOR = "[data-specular-button]";

function wrapDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/** Adds the pointer-following specular edge treatment to selected existing controls. */
export function initSpecularButtons(root = document) {
  for (const button of root.querySelectorAll(SPECULAR_BUTTON_SELECTOR)) {
    const updateHighlight = (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;

      const bounds = button.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const angleFromTop = Math.atan2(y - bounds.height / 2, x - bounds.width / 2) * 180 / Math.PI + 90;

      button.style.setProperty("--specular-angle", `${wrapDegrees(angleFromTop - 28)}deg`);
      button.style.setProperty("--specular-x", `${(x / bounds.width) * 100}%`);
      button.style.setProperty("--specular-y", `${(y / bounds.height) * 100}%`);
    };

    button.addEventListener("pointerenter", () => button.classList.add("is-specular-active"));
    button.addEventListener("pointermove", updateHighlight, { passive: true });
    button.addEventListener("pointerleave", () => {
      button.classList.remove("is-specular-active");
      button.style.removeProperty("--specular-angle");
      button.style.removeProperty("--specular-x");
      button.style.removeProperty("--specular-y");
    });
  }
}

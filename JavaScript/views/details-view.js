import { pathFor } from "../router.js";
import { createRequestCard } from "./view-utils.js";

const detailsEmpty = document.querySelector("#details-empty");
const detailsEmptyTitle = document.querySelector("#details-empty-title");
const detailsEmptyText = document.querySelector("#details-empty-text");
const detailsContainer = document.querySelector("#selected-request-details");
const detailsNavLink = document.querySelector("#details-nav-link");

export function renderDetailsView(requests, selectedRequestId, profile) {
  detailsContainer.replaceChildren();
  const selected = requests.find((request) => request.id === selectedRequestId);
  detailsEmpty.hidden = Boolean(selected);

  if (selected) {
    detailsContainer.append(
      createRequestCard(selected, { profile, headingLevel: 2 }),
    );
  } else if (selectedRequestId) {
    detailsEmptyTitle.textContent = "Solicitação não encontrada";
    detailsEmptyText.textContent =
      "Não existe uma solicitação com este endereço neste navegador. Ela pode ter sido removida ou criada em outro navegador.";
  } else {
    detailsEmptyTitle.textContent = "Nenhuma solicitação selecionada";
    detailsEmptyText.textContent =
      "Os detalhes serão exibidos quando houver uma solicitação disponível.";
  }

  detailsNavLink.href = pathFor("details", selectedRequestId);
}

export function bindDetailsView(onAction) {
  detailsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-request-id]");
    if (button) {
      onAction(button);
    }
  });
}

import { getRecentRequests, renderDashboard } from "../dashboard.js";
import { createSummaryCard } from "./view-utils.js";

const recentRequestList = document.querySelector("#dashboard-recent-list");
const emptyState = document.querySelector("#dashboard-empty");

export function renderPanelView(requests) {
  const recentRequests = getRecentRequests(requests);
  recentRequestList.replaceChildren();
  emptyState.hidden = requests.length > 0;
  recentRequestList.hidden = recentRequests.length === 0;
  recentRequests.forEach((request, index) => {
    recentRequestList.append(
      createSummaryCard(request, index, "Abrir detalhes"),
    );
  });
  renderDashboard(requests);
}

export function bindPanelView(onAction) {
  recentRequestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-request-id]");
    if (button) {
      onAction(button);
    }
  });
}

import { getFilteredRequests, REQUEST_STATUS_OPTIONS } from "../queries.js";
import {
  REQUEST_CATEGORY_OPTIONS,
  REQUEST_URGENCY_OPTIONS,
} from "../requests.js";
import { createRequestCard, populateSelect } from "./view-utils.js";

const requestList = document.querySelector("#request-list");
const requestsEmpty = document.querySelector("#requests-empty");
const requestsNoResults = document.querySelector("#requests-no-results");
const requestSearch = document.querySelector("#request-search");
const categoryFilter = document.querySelector("#filter-category");
const statusFilter = document.querySelector("#filter-status");
const urgencyFilter = document.querySelector("#filter-urgency");
const resultsAnnouncement = document.querySelector(
  "#request-results-announcement",
);
const clearFiltersButton = document.querySelector("#clear-request-filters");

function renderRequestList(requests, profile) {
  requestList.replaceChildren();
  const { matches, groupedRequests } = getFilteredRequests(requests, {
    term: requestSearch.value,
    category: categoryFilter.value,
    status: statusFilter.value,
    urgency: urgencyFilter.value,
  });
  requestsEmpty.hidden = requests.length > 0;
  requestsNoResults.hidden = requests.length === 0 || matches.length > 0;
  requestList.hidden = matches.length === 0;
  resultsAnnouncement.textContent = `${matches.length} ${matches.length === 1 ? "solicitação encontrada" : "solicitações encontradas"}.`;

  for (const [label, groupRequests] of groupedRequests) {
    const group = document.createElement("section");
    group.className = "request-group";
    const heading = document.createElement("h2");
    heading.className = "request-group-title";
    heading.textContent = label;
    const cards = document.createElement("div");
    cards.className = "request-group-list";
    groupRequests.forEach((request, index) => {
      cards.append(
        createRequestCard(request, {
          profile,
          withDetailsButton: true,
          headingLevel: 3,
          index,
        }),
      );
    });
    group.append(heading, cards);
    requestList.append(group);
  }
}

export function renderRequestsView(requests, profile) {
  renderRequestList(requests, profile);
}

export function bindRequestsView(onAction, onFilterChange) {
  populateSelect(categoryFilter, REQUEST_CATEGORY_OPTIONS);
  populateSelect(statusFilter, REQUEST_STATUS_OPTIONS);
  populateSelect(urgencyFilter, REQUEST_URGENCY_OPTIONS);

  requestList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-request-id]");
    if (button) {
      onAction(button);
    }
  });
  requestSearch.addEventListener("input", onFilterChange);
  for (const control of [categoryFilter, statusFilter, urgencyFilter]) {
    control.addEventListener("change", onFilterChange);
  }
  clearFiltersButton.addEventListener("click", () => {
    requestSearch.value = "";
    categoryFilter.value = "";
    statusFilter.value = "";
    urgencyFilter.value = "";
    onFilterChange();
    requestSearch.focus();
  });
}

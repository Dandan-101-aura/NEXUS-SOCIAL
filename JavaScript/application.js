import {
  assignVolunteer,
  cancelRequest,
  confirmReceipt,
  createRequest,
  declareCompletion,
  DEMO_PROFILES,
  reopenRequest,
  suspendForReview,
  withdrawFromRequest,
} from "./requests.js";
import {
  loadRequests,
  saveRequests,
  STORAGE_KEY,
  StorageError,
} from "./storage.js";
import { hydrateIcons } from "./icons.js";
import { renderCommunityStories } from "./community.js";
import { dismissToast, showToast } from "./toast.js";
import { initTheme } from "./theme.js";
import { navigateTo, startRouter } from "./router.js";
import { buildSampleRequests, downloadBackup } from "./backup.js";
import { bindDetailsView, renderDetailsView } from "./views/details-view.js";
import { bindHistoryView, renderHistoryView } from "./views/history-view.js";
import { bindPanelView, renderPanelView } from "./views/panel-view.js";
import { bindRequestForm } from "./views/request-form-view.js";
import { bindRequestsView, renderRequestsView } from "./views/requests-view.js";
import { ROLE_LABELS } from "./views/view-utils.js";

const views = [...document.querySelectorAll(".view")];
const navigationLinks = [...document.querySelectorAll(".nav-link[data-view]")];
const navigation = document.querySelector("#site-navigation");
const menuToggle = document.querySelector(".menu-toggle");
const backdrop = document.querySelector(".nav-backdrop");
const announcement = document.querySelector("#navigation-announcement");
const mainContent = document.querySelector("#main-content");
const profileSelect = document.querySelector("#demo-profile");
const actionDialog = document.querySelector("#action-dialog");
const actionDialogForm = document.querySelector("#action-dialog-form");
const actionDialogTitle = document.querySelector("#action-dialog-title");
const actionDialogDescription = document.querySelector(
  "#action-dialog-description",
);
const actionDialogConfirm = document.querySelector("#action-dialog-confirm");
const actionDialogError = document.querySelector("#action-dialog-error");
const actionReasonField = document.querySelector("#action-reason-field");
const actionReason = document.querySelector("#action-reason");
const actionReasonError = document.querySelector("#action-reason-error");
const exportButton = document.querySelector("#export-backup");
const samplesButton = document.querySelector("#load-samples");
const sidebarAvatar = document.querySelector("#sidebar-avatar");
const sidebarProfileName = document.querySelector("#sidebar-profile-name");

const VIEW_TITLES = Object.freeze({
  dashboard: "Painel principal",
  requests: "Solicitações",
  "new-request": "Cadastrar solicitação",
  details: "Detalhes da solicitação",
  history: "Histórico",
});

const AVATAR_COLORS = Object.freeze({
  solicitante: "#047857",
  voluntario: "#1d4ed8",
  moderador: "#7c3aed",
});

const ACTION_DIALOGS = Object.freeze({
  assign: {
    title: "Assumir atendimento",
    description:
      "A solicitação será atribuída ao perfil de voluntário selecionado.",
    confirmLabel: "Assumir",
  },
  withdraw: {
    title: "Desistir do atendimento",
    description:
      "Confirma a desistência? A solicitação voltará a ficar aberta para outro atendimento.",
    confirmLabel: "Confirmar desistência",
  },
  complete: {
    title: "Declarar conclusão",
    description:
      "Isto registra apenas a declaração do voluntário. Não confirma o recebimento nem uma entrega física.",
    confirmLabel: "Declarar conclusão",
  },
  confirm: {
    title: "Confirmar recebimento na demonstração",
    description:
      "Esta ação é uma confirmação declarada no ambiente de demonstração; o sistema não verifica a entrega física.",
    confirmLabel: "Confirmar na demonstração",
  },
  cancel: {
    title: "Cancelar solicitação",
    description:
      "A solicitação deixará de aceitar novas atribuições. Informe o motivo para manter o registro da decisão.",
    confirmLabel: "Cancelar solicitação",
    requiresReason: true,
    reasonLabel: "Motivo do cancelamento",
  },
  suspend: {
    title: "Suspender para revisão",
    description:
      "A solicitação ficará indisponível enquanto é revisada. Uma atribuição ativa será encerrada, mas permanecerá no histórico.",
    confirmLabel: "Suspender",
    requiresReason: true,
    reasonLabel: "Justificativa da revisão",
  },
  reopen: {
    title: "Reabrir solicitação",
    description:
      "A solicitação voltará ao estado aberto para uma nova etapa. As datas e eventos anteriores serão preservados.",
    confirmLabel: "Reabrir",
    requiresReason: true,
    reasonLabel: "Justificativa da reabertura",
  },
  seed: {
    title: "Carregar dados de exemplo",
    description:
      "Serão acrescentadas solicitações fictícias de exemplo. Nenhuma solicitação existente será alterada ou removida.",
    confirmLabel: "Adicionar exemplos",
  },
});

let requests = [];
let selectedRequestId = null;
let pendingAction = null;

function currentProfile() {
  return DEMO_PROFILES[profileSelect.value];
}

function renderApplication() {
  const profile = currentProfile();
  renderPanelView(requests);
  renderRequestsView(requests, profile);
  renderDetailsView(requests, selectedRequestId, profile);
  renderHistoryView(requests);
}

function closeMobileNavigation() {
  navigation.classList.remove("is-open");
  backdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir navegação");
  navigation.inert = window.matchMedia("(max-width: 680px)").matches;
}

function updateNavigationForViewport() {
  const isMobile = window.matchMedia("(max-width: 680px)").matches;
  navigation.inert = isMobile && !navigation.classList.contains("is-open");
  if (!isMobile) {
    closeMobileNavigation();
  }
}

function bindNavigation() {
  menuToggle.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    backdrop.hidden = !isOpen;
    navigation.inert =
      !isOpen && window.matchMedia("(max-width: 680px)").matches;
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Fechar navegação" : "Abrir navegação",
    );
    if (isOpen) {
      navigationLinks[0].focus();
    }
  });

  backdrop.addEventListener("click", () => {
    closeMobileNavigation();
    menuToggle.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("is-open")) {
      closeMobileNavigation();
      menuToggle.focus();
    }
  });

  for (const link of navigationLinks) {
    link.addEventListener("click", closeMobileNavigation);
  }

  window.addEventListener("resize", updateNavigationForViewport);
  updateNavigationForViewport();
}

function showView(viewName, moveFocus) {
  const targetView = document.querySelector(`#view-${viewName}`);
  const targetLink = navigationLinks.find(
    (link) => link.dataset.view === viewName,
  );
  if (!targetView || !targetLink) {
    return;
  }

  for (const view of views) {
    const isTarget = view === targetView;
    view.hidden = !isTarget;
    view.classList.toggle("is-visible", isTarget);
  }

  for (const link of navigationLinks) {
    const isCurrent = link === targetLink;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  }

  const title = VIEW_TITLES[viewName];
  announcement.textContent = title;
  document.title = `${title} | NEXUS SOCIAL`;
  closeMobileNavigation();

  if (moveFocus) {
    mainContent.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

function handleRoute({ view, id }, { initial }) {
  if (view === "details") {
    selectedRequestId = id ?? selectedRequestId;
    renderDetailsView(requests, selectedRequestId, currentProfile());
  }
  showView(view, !initial);
}

function logUnexpectedError(message, error) {
  if (!(error instanceof StorageError) && !error?.validationErrors) {
    console.error(message, error);
  }
}

function restoreFocus({ opener, requestId }) {
  requestAnimationFrame(() => {
    if (opener?.isConnected) {
      opener.focus();
      return;
    }
    const card = requestId
      ? document.querySelector(
          `.view:not([hidden]) .request-card[data-request-id="${CSS.escape(requestId)}"]`,
        )
      : null;
    (card ?? mainContent).focus({ preventScroll: true });
  });
}

function openActionDialog(action, requestId, opener) {
  const configuration = ACTION_DIALOGS[action];
  if (!configuration) {
    return;
  }
  pendingAction = { action, requestId, opener, profile: currentProfile() };
  actionDialogTitle.textContent = configuration.title;
  actionDialogDescription.textContent = configuration.description;
  actionDialogConfirm.textContent = configuration.confirmLabel;
  actionReasonField.hidden = !configuration.requiresReason;
  actionReason.required = Boolean(configuration.requiresReason);
  actionReason.value = "";
  actionReasonError.textContent = "";
  actionReason.removeAttribute("aria-invalid");
  actionDialogError.hidden = true;
  actionDialogError.textContent = "";
  if (configuration.requiresReason) {
    actionReason.labels[0].textContent = configuration.reasonLabel;
  }
  actionDialog.showModal();
}

function handleAction(button) {
  if (button.dataset.action === "details") {
    navigateTo("details", button.dataset.requestId);
  } else {
    openActionDialog(button.dataset.action, button.dataset.requestId, button);
  }
}

function executeAction(action, requestId, profile, reason) {
  switch (action) {
    case "assign":
      return assignVolunteer(requestId, profile);
    case "withdraw":
      return withdrawFromRequest(requestId, profile);
    case "complete":
      return declareCompletion(requestId, profile);
    case "confirm":
      return confirmReceipt(requestId, profile);
    case "cancel":
      return cancelRequest(requestId, profile, reason);
    case "suspend":
      return suspendForReview(requestId, profile, reason);
    case "reopen":
      return reopenRequest(requestId, profile, reason);
    default:
      throw new Error("Ação de solicitação desconhecida.");
  }
}

function addSampleRequests() {
  const samples = buildSampleRequests(requests);
  if (samples.length === 0) {
    showToast("Os exemplos já estão cadastrados.", "info");
    return;
  }
  requests = saveRequests([...requests, ...samples]);
  renderApplication();
  showToast(
    `${samples.length} solicitações de exemplo adicionadas.`,
    "success",
  );
}

function bindActionDialog() {
  document
    .querySelector("#action-dialog-cancel")
    .addEventListener("click", () => actionDialog.close());
  actionDialog.addEventListener("close", () => {
    const closed = pendingAction;
    pendingAction = null;
    if (closed) {
      restoreFocus(closed);
    }
  });

  actionDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!pendingAction) {
      return;
    }

    const { action, requestId, profile } = pendingAction;
    const configuration = ACTION_DIALOGS[action];
    const reason = actionReason.value.trim();
    actionDialogError.hidden = true;

    if (
      configuration.requiresReason &&
      (reason.length < 3 || reason.length > 500)
    ) {
      actionReasonError.textContent =
        "A justificativa deve ter de 3 a 500 caracteres.";
      actionReason.setAttribute("aria-invalid", "true");
      actionReason.focus();
      return;
    }
    actionReason.removeAttribute("aria-invalid");
    actionReasonError.textContent = "";

    actionDialogConfirm.disabled = true;
    try {
      if (action === "seed") {
        addSampleRequests();
      } else {
        const updatedRequest = executeAction(
          action,
          requestId,
          profile,
          reason,
        );
        requests = requests.map((request) =>
          request.id === updatedRequest.id ? updatedRequest : request,
        );
        renderApplication();
        showToast(
          action === "confirm"
            ? "Recebimento registrado somente na demonstração."
            : `${configuration.confirmLabel} — alteração registrada.`,
          "success",
        );
      }
      dismissToast("storage");
      actionDialog.close();
    } catch (error) {
      logUnexpectedError("Falha ao executar ação:", error);
      actionDialogError.textContent = error.message;
      actionDialogError.hidden = false;
    } finally {
      actionDialogConfirm.disabled = false;
    }
  });
}

function submitRequest(values) {
  const request = createRequest(values, requests, currentProfile());
  requests = saveRequests([...requests, request]);
  renderApplication();
  showToast("Solicitação cadastrada e salva neste navegador.", "success");
  dismissToast("storage");
  return true;
}

function updateSidebarAvatar() {
  const profile = currentProfile();
  const label = ROLE_LABELS[profile.role] ?? profile.role;
  sidebarAvatar.textContent = label.charAt(0).toUpperCase();
  sidebarAvatar.style.background =
    AVATAR_COLORS[profile.role] ?? "var(--primary)";
  sidebarProfileName.textContent = label;
}

function handleProfileChange() {
  updateSidebarAvatar();
  renderApplication();
}

function showStorageError(error) {
  showToast(error.message, "error", { key: "storage", duration: 0 });
}

function initialize() {
  try {
    requests = loadRequests();
  } catch (error) {
    logUnexpectedError("Falha ao inicializar os dados locais:", error);
    requests = error instanceof StorageError ? (error.validRequests ?? []) : [];
    showStorageError(error);
  }
  renderApplication();
}

function bindStorageSynchronization() {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }
    try {
      requests = loadRequests();
      dismissToast("storage");
    } catch (error) {
      logUnexpectedError(
        "Falha ao atualizar dados locais de outra aba:",
        error,
      );
      if (error instanceof StorageError && error.validRequests) {
        requests = error.validRequests;
      }
      showStorageError(error);
    }
    renderApplication();
  });
}

function bindToolbarActions() {
  for (const button of document.querySelectorAll("[data-navigate]")) {
    button.addEventListener("click", () => navigateTo(button.dataset.navigate));
  }

  samplesButton.addEventListener("click", () =>
    openActionDialog("seed", null, samplesButton),
  );
  exportButton.addEventListener("click", () => {
    if (requests.length === 0) {
      showToast("Ainda não há solicitações para exportar.", "info");
      return;
    }
    try {
      downloadBackup(requests);
      showToast(
        `Backup com ${requests.length} solicitação(ões) baixado.`,
        "success",
      );
    } catch (error) {
      logUnexpectedError("Falha ao exportar o backup:", error);
      showToast("Não foi possível gerar o arquivo de backup.", "error");
    }
  });
}

export function startApplication() {
  hydrateIcons();
  initTheme(document.querySelector("#theme-toggle"));
  renderCommunityStories(document.querySelector("#community-stories"));

  bindNavigation();
  bindRequestForm({
    getProfile: currentProfile,
    onSubmit: submitRequest,
    onError: (error) =>
      logUnexpectedError("Falha ao cadastrar a solicitação:", error),
    onProfileChange: handleProfileChange,
  });
  bindPanelView(handleAction);
  bindRequestsView(handleAction, () =>
    renderRequestsView(requests, currentProfile()),
  );
  bindDetailsView(handleAction);
  bindHistoryView(handleAction);
  bindActionDialog();
  bindToolbarActions();
  bindStorageSynchronization();

  updateSidebarAvatar();
  initialize();
  startRouter(handleRoute);
}

import {
  REQUEST_CATEGORY_OPTIONS,
  REQUEST_LIMITS,
  REQUEST_UNIT_OPTIONS,
  REQUEST_URGENCY_OPTIONS,
  validateRequestInput,
} from "../requests.js";
import { populateSelect } from "./view-utils.js";
import { showToast } from "../toast.js";

const requestForm = document.querySelector("#request-form");
const descriptionInput = document.querySelector("#request-description");
const descriptionCounter = document.querySelector(
  "#request-description-counter",
);
const profileSelect = document.querySelector("#demo-profile");
const submitButton = requestForm.querySelector("#request-submit");

function errorElementFor(field) {
  return document.querySelector(`#${field.id}-error`);
}

function clearFieldError(field) {
  const error = errorElementFor(field);
  if (error) {
    error.textContent = "";
  }
  field.removeAttribute("aria-invalid");
}

function setFieldError(field, message) {
  const error = errorElementFor(field);
  if (error) {
    error.textContent = message;
  }
  field.setAttribute("aria-invalid", "true");
}

function clearFieldErrors() {
  for (const field of requestForm.elements) {
    if (field instanceof HTMLElement && field.name) {
      clearFieldError(field);
    }
  }
}

function showFieldErrors(errors) {
  clearFieldErrors();
  for (const [fieldName, message] of Object.entries(errors)) {
    const field = requestForm.elements.namedItem(fieldName);
    if (field instanceof HTMLElement) {
      setFieldError(field, message);
    }
  }
  Object.keys(errors)
    .map((name) => requestForm.elements.namedItem(name))
    .find((field) => field instanceof HTMLElement)
    ?.focus();
}

function readFormValues() {
  return Object.fromEntries(new FormData(requestForm).entries());
}

export function updateDescriptionCounter() {
  const length = [...descriptionInput.value].length;
  const max = REQUEST_LIMITS.description.max;
  descriptionCounter.textContent = `${length} / ${max}`;
  descriptionCounter.classList.toggle(
    "is-warning",
    length >= max * 0.9 && length < max,
  );
  descriptionCounter.classList.toggle("is-limit", length >= max);
}

function validateSingleField(field) {
  if (
    !(field instanceof HTMLElement) ||
    !field.name ||
    !requestForm.contains(field)
  ) {
    return;
  }
  if (field.dataset.touched !== "true" && !field.value) {
    return;
  }
  const message = validateRequestInput(readFormValues()).errors[field.name];
  if (message) {
    setFieldError(field, message);
  } else {
    clearFieldError(field);
  }
}

function updateSubmitState(getProfile) {
  submitButton.disabled = getProfile().role === "voluntario";
}

export function bindRequestForm({
  getProfile,
  onSubmit,
  onError,
  onProfileChange,
}) {
  let isSubmitting = false;
  populateSelect(
    document.querySelector("#request-category"),
    REQUEST_CATEGORY_OPTIONS,
  );
  populateSelect(document.querySelector("#request-unit"), REQUEST_UNIT_OPTIONS);
  populateSelect(
    document.querySelector("#request-urgency"),
    REQUEST_URGENCY_OPTIONS,
  );
  updateDescriptionCounter();
  updateSubmitState(getProfile);

  profileSelect.addEventListener("change", () => {
    updateSubmitState(getProfile);
    onProfileChange();
  });

  requestForm.addEventListener("input", (event) => {
    const field = event.target;
    if (!(field instanceof HTMLElement) || !field.name) {
      return;
    }
    field.dataset.touched = "true";
    clearFieldError(field);
    if (field === descriptionInput) {
      updateDescriptionCounter();
    }
  });

  requestForm.addEventListener("change", (event) => {
    const field = event.target;
    if (field instanceof HTMLElement && field.name) {
      field.dataset.touched = "true";
      validateSingleField(field);
    }
  });

  requestForm.addEventListener("focusout", (event) =>
    validateSingleField(event.target),
  );

  requestForm.addEventListener("reset", () => {
    setTimeout(() => {
      for (const field of requestForm.elements) {
        if (field instanceof HTMLElement) {
          delete field.dataset.touched;
        }
      }
      updateDescriptionCounter();
    }, 0);
  });

  requestForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const profile = getProfile();
    if (!["solicitante", "moderador"].includes(profile.role)) {
      showToast(
        "O cadastro está disponível apenas aos perfis de solicitante ou moderador da demonstração.",
        "error",
      );
      return;
    }

    clearFieldErrors();
    const validation = validateRequestInput(readFormValues());
    if (!validation.isValid) {
      showFieldErrors(validation.errors);
      showToast("Revise os campos destacados antes de salvar.", "error");
      return;
    }

    isSubmitting = true;
    submitButton.disabled = true;
    try {
      if (onSubmit(validation.values)) {
        requestForm.reset();
        clearFieldErrors();
      }
    } catch (error) {
      onError(error);
      if (error.validationErrors) {
        showFieldErrors(error.validationErrors);
        showToast("Revise os campos destacados antes de salvar.", "error");
      } else {
        showToast(error.message, "error");
      }
    } finally {
      isSubmitting = false;
      updateSubmitState(getProfile);
    }
  });
}

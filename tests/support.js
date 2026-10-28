export class MemoryStorage {
  #items = new Map();

  failRead = false;

  failWriteKey = null;

  constructor(entries = []) {
    for (const [key, value] of entries) {
      this.#items.set(key, String(value));
    }
  }

  get length() {
    return this.#items.size;
  }

  getItem(key) {
    if (this.failRead) {
      throw new Error("Simulated storage read failure");
    }
    return this.#items.get(String(key)) ?? null;
  }

  setItem(key, value) {
    if (this.failWriteKey === String(key)) {
      throw new DOMException("Simulated quota exceeded", "QuotaExceededError");
    }
    this.#items.set(String(key), String(value));
  }

  removeItem(key) {
    this.#items.delete(String(key));
  }

  key(index) {
    return [...this.#items.keys()][index] ?? null;
  }
}

export function installIsolatedStorage(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  t.after(() => {
    if (previous) {
      Object.defineProperty(globalThis, "localStorage", previous);
    } else {
      delete globalThis.localStorage;
    }
  });

  return storage;
}

export function validRequestInput(overrides = {}) {
  return {
    title: "Solicitação de teste",
    description: "Descrição válida para os testes automatizados.",
    category: "Alimentos não perecíveis",
    quantity: "2",
    unit: "unidades",
    region: "Centro",
    declaredUrgency: "media",
    ...overrides,
  };
}

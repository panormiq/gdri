(() => {
  const i18n = {
    locale: "fr",
    strings: {},
    t(key, fallback, params) {
      let value = this.strings[key] ?? fallback ?? key;
      if (params && typeof value === "string") {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          value = value.split(`{${paramKey}}`).join(String(paramValue));
        });
      }
      return value;
    }
  };

  const applyToDocument = () => {
    const root = document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const value = i18n.t(key, el.textContent);
      el.textContent = value;
    });

    const attrMap = {
      placeholder: "data-i18n-placeholder",
      title: "data-i18n-title",
      alt: "data-i18n-alt",
      "aria-label": "data-i18n-aria-label",
      value: "data-i18n-value"
    };

    Object.entries(attrMap).forEach(([attr, dataAttr]) => {
      root.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
        const key = el.getAttribute(dataAttr);
        if (!key) return;
        const value = i18n.t(key, el.getAttribute(attr) || "");
        el.setAttribute(attr, value);
      });
    });
  };

  const loadStrings = async () => {
    try {
      const response = await fetch(`./i18n/${i18n.locale}.json`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      i18n.strings = payload || {};
    } catch (error) {
      // ignore fetch errors
    }
  };

  window.WORKFLOW_BUILDER_I18N = i18n;
  window.workflowBuilderT = (key, fallback, params) => i18n.t(key, fallback, params);
  window.applyWorkflowBuilderI18n = () => applyToDocument();

  i18n.ready = loadStrings().then(applyToDocument);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      i18n.ready.then(applyToDocument);
    });
  } else {
    i18n.ready.then(applyToDocument);
  }
})();

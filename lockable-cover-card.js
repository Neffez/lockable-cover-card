/*
 * Lockable Cover Card
 *
 * Renders the *native* Home Assistant tile card (the modern cover look:
 * icon, name, open/stop/close buttons and a position slider) and overlays a
 * small lock chip in the top-right corner. The chip toggles a lock entity;
 * while locked it turns red. Because it reuses the stock tile card, it looks
 * exactly like a native HA cover tile.
 *
 * Config:
 *   type: custom:lockable-cover-card
 *   entity: cover.office_lockable      # cover to display
 *   name: Office                       # optional, passed to the native card
 *   lock_entity: switch.xxx          # optional; otherwise read from the
 *                                    #   cover's `lock_entity` attribute
 *   features: [...]                  # optional; override the tile features
 *
 * Any other options are forwarded to the underlying native tile card.
 */

class LockableCoverCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You need to define an 'entity' (a cover).");
    }
    if (!config.entity.startsWith("cover.")) {
      throw new Error("'entity' must be a cover entity.");
    }
    this._config = config;
    this._card = undefined;
    this._buildOnce();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._card) {
      this._card.hass = hass;
    }
    this._updateChip();
  }

  getCardSize() {
    return (this._card && this._card.getCardSize && this._card.getCardSize()) || 2;
  }

  // Sections view: mimic a native tile (half width, auto height) so the card
  // is not stretched to the full grid width.
  getGridOptions() {
    if (this._card && this._card.getGridOptions) {
      return this._card.getGridOptions();
    }
    return { columns: 6, rows: "auto", min_columns: 6 };
  }

  getLayoutOptions() {
    if (this._card && this._card.getLayoutOptions) {
      return this._card.getLayoutOptions();
    }
    return { grid_columns: 2, grid_rows: "auto" };
  }

  static getStubConfig() {
    return { entity: "" };
  }

  async _buildOnce() {
    // Wrapper so we can position the chip relative to the native card.
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    const chip = document.createElement("div");
    chip.className = "clc-chip";
    chip.innerHTML = `
      <style>
        .clc-chip {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 18px;
          background: var(--card-background-color, var(--ha-card-background, #fff));
          box-shadow: var(--ha-card-box-shadow,
                      0 2px 2px 0 rgba(0,0,0,.14),
                      0 1px 5px 0 rgba(0,0,0,.12));
          color: var(--secondary-text-color);
          cursor: pointer;
          transition: color .15s ease-in-out, background .15s ease-in-out;
          --mdc-icon-size: 20px;
        }
        .clc-chip:hover { background: var(--secondary-background-color); }
        .clc-chip.locked { color: var(--error-color, #db4437); }
        .clc-chip.hidden { display: none; }
      </style>
      <ha-icon icon="mdi:lock-open-variant"></ha-icon>
    `;
    chip.addEventListener("click", (ev) => {
      ev.stopPropagation();
      this._toggleLock();
    });

    wrapper.appendChild(chip);
    this.innerHTML = "";
    this.appendChild(wrapper);
    this._chip = chip;
    this._chipIcon = chip.querySelector("ha-icon");
    this._wrapper = wrapper;

    // Build the native tile card and insert it before the chip.
    const helpers = await window.loadCardHelpers();
    const nativeConfig = { ...this._config, type: "tile" };
    delete nativeConfig.lock_entity;
    if (!nativeConfig.features) {
      nativeConfig.features = this._defaultFeatures();
    }
    const card = helpers.createCardElement(nativeConfig);
    if (this._hass) card.hass = this._hass;
    wrapper.insertBefore(card, chip);
    this._card = card;
    this._updateChip();
  }

  _defaultFeatures() {
    // Pick tile features based on what the cover supports, so blinds get a
    // tilt slider automatically while shutters only get position.
    const OPEN = 1, CLOSE = 2, SET_POSITION = 4, STOP = 8;
    const OPEN_TILT = 16, CLOSE_TILT = 32, SET_TILT_POSITION = 128;
    const stateObj = this._hass && this._hass.states[this._config.entity];
    const f = (stateObj && stateObj.attributes.supported_features) || 0;
    const features = [];
    if (f & (OPEN | CLOSE | STOP)) features.push({ type: "cover-open-close" });
    if (f & SET_POSITION) features.push({ type: "cover-position" });
    if (f & SET_TILT_POSITION) {
      features.push({ type: "cover-tilt-position" });
    } else if (f & (OPEN_TILT | CLOSE_TILT)) {
      features.push({ type: "cover-tilt" });
    }
    if (!features.length) features.push({ type: "cover-open-close" });
    return features;
  }

  _lockEntity() {
    const stateObj = this._hass && this._hass.states[this._config.entity];
    return (
      this._config.lock_entity ||
      (stateObj && stateObj.attributes && stateObj.attributes.lock_entity) ||
      null
    );
  }

  _isLocked() {
    const stateObj = this._hass && this._hass.states[this._config.entity];
    if (stateObj && stateObj.attributes && "locked" in stateObj.attributes) {
      return stateObj.attributes.locked === true;
    }
    const lockEntity = this._lockEntity();
    if (lockEntity && this._hass.states[lockEntity]) {
      return this._hass.states[lockEntity].state === "on";
    }
    return false;
  }

  _updateChip() {
    if (!this._chip || !this._hass) return;
    const lockEntity = this._lockEntity();
    if (!lockEntity) {
      this._chip.classList.add("hidden");
      return;
    }
    this._chip.classList.remove("hidden");
    const locked = this._isLocked();
    this._chip.classList.toggle("locked", locked);
    this._chipIcon.setAttribute(
      "icon",
      locked ? "mdi:lock" : "mdi:lock-open-variant"
    );
    this._chip.title = locked
      ? "Gesperrt – tippen zum Entsperren"
      : "Entsperrt – tippen zum Sperren";
  }

  _toggleLock() {
    const lockEntity = this._lockEntity();
    if (!lockEntity || !this._hass) return;
    this._hass.callService("homeassistant", "toggle", {
      entity_id: lockEntity,
    });
  }
}

customElements.define("lockable-cover-card", LockableCoverCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lockable-cover-card",
  name: "Lockable Cover Card",
  description: "Native cover card with a lock chip on top.",
});

/* -------------------------------------------------------------------------
 * Lockable Cover Tile Feature  (recommended)
 *
 * A custom tile feature that adds a lock toggle row to the *native* HA tile
 * card. Because it plugs into the stock tile card, the result looks exactly
 * like a native cover tile (icon, name, open/stop/close, position / tilt
 * sliders) with one extra row containing the lock button.
 *
 * Usage:
 *   type: tile
 *   entity: cover.office_lockable
 *   features:
 *     - type: cover-open-close
 *     - type: cover-position
 *     - type: custom:lockable-cover-feature
 *       # lock_entity: switch.xxx   # optional; else read from `lock_entity` attr
 * ---------------------------------------------------------------------- */

class LockableCoverFeature extends HTMLElement {
  static getStubConfig() {
    return { type: "custom:lockable-cover-feature" };
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  set stateObj(stateObj) {
    this._stateObj = stateObj;
    this._render();
  }

  disconnectedCallback() {}

  _lockEntity() {
    const attrs = this._stateObj && this._stateObj.attributes;
    return (
      (this._config && this._config.lock_entity) ||
      (attrs && attrs.lock_entity) ||
      null
    );
  }

  _isLocked() {
    const attrs = this._stateObj && this._stateObj.attributes;
    if (attrs && "locked" in attrs) {
      return attrs.locked === true;
    }
    const lockEntity = this._lockEntity();
    if (lockEntity && this._hass && this._hass.states[lockEntity]) {
      return this._hass.states[lockEntity].state === "on";
    }
    return false;
  }

  _render() {
    if (!this._hass || !this._stateObj || !this._config) return;
    const lockEntity = this._lockEntity();
    if (!lockEntity) {
      this.innerHTML = "";
      this._group = undefined;
      return;
    }

    if (!this._group) {
      const style = document.createElement("style");
      style.textContent = `
        ha-control-button-group {
          margin: 0 12px 12px;
          --control-button-group-spacing: 12px;
          --control-button-group-thickness: 40px;
        }`;
      this._group = document.createElement("ha-control-button-group");
      this._btn = document.createElement("ha-control-button");
      this._icon = document.createElement("ha-icon");
      this._btn.appendChild(this._icon);
      this._group.appendChild(this._btn);
      this.appendChild(style);
      this.appendChild(this._group);
      this._btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._toggle();
      });
    }

    const locked = this._isLocked();
    this._icon.setAttribute(
      "icon",
      locked ? "mdi:lock" : "mdi:lock-open-variant"
    );
    this._btn.title = locked
      ? "Gesperrt – tippen zum Entsperren"
      : "Entsperrt – tippen zum Sperren";
    this._btn.style.setProperty(
      "--control-button-background-color",
      locked ? "var(--error-color)" : ""
    );
    this._btn.style.setProperty(
      "--control-button-icon-color",
      locked ? "var(--error-color)" : ""
    );
  }

  _toggle() {
    const lockEntity = this._lockEntity();
    if (!lockEntity || !this._hass) return;
    this._hass.callService("homeassistant", "toggle", {
      entity_id: lockEntity,
    });
  }
}

customElements.define("lockable-cover-feature", LockableCoverFeature);

window.customTileFeatures = window.customTileFeatures || [];
window.customTileFeatures.push({
  type: "lockable-cover-feature",
  name: "Lockable Cover",
  supported: (stateObj) =>
    !!stateObj && stateObj.entity_id.startsWith("cover."),
  configurable: false,
});

console.info(
  "%c LOCKABLE-COVER-CARD %c 1.7.0 ",
  "background:#03a9f4;color:#fff",
  ""
);

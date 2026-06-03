# Lockable Cover Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

A Lovelace card for Home Assistant that renders the **native HA cover tile**
(icon, name, open/stop/close buttons and a position slider) and overlays a
small **lock chip** in the top-right corner. The chip toggles a lock entity and
turns red while locked. Because it reuses the stock tile card, it looks exactly
like a native cover tile.

The module also registers a **tile feature** variant (`lockable-cover-feature`) that
adds the lock as its own button row inside the standard tile card.

> **Works standalone.** It pairs nicely with the companion
> [`cover_lock`](https://github.com/neffez/lockable-cover)
> integration (auto-reading the proxy's `locked` / `lock_entity` attributes),
> but it works on **any** cover — just set `lock_entity` explicitly in the card
> config. No integration required.

## Preview

A native cover tile with a lock chip in the corner. Tap the chip to toggle the
lock; it turns red while locked.

## Installation

### Via HACS (custom repository)

1. In Home Assistant go to **HACS → ⋮ (top right) → Custom repositories**.
2. Add this repository URL and choose category **Dashboard**.
3. Search for **Lockable Cover Card**, install it.
4. Hard-refresh your browser (Ctrl/Cmd+Shift+R).

HACS adds the Lovelace resource automatically.

### Manual installation

1. Copy `lockable-cover-card.js` into your `/config/www/` folder.
2. Add it as a dashboard resource (**Settings → Dashboards → ⋮ → Resources**):
   - URL: `/local/lockable-cover-card.js`
   - Resource type: **JavaScript Module**
3. Hard-refresh your browser.

## Usage

### A) Corner lock chip — wrapper card (recommended)

```yaml
type: custom:lockable-cover-card
entity: cover.office_lockable
name: Office
# lock_entity: switch.xxx   # optional; auto-read from a cover_lock proxy
# features:                 # optional; auto-derived from supported_features
#   - type: cover-open-close
#   - type: cover-position
```

### B) Lock as a feature row — tile feature

Adds the lock as its own row to the stock tile card. Easy to add from the tile
UI editor, but it occupies a full row.

```yaml
type: tile
entity: cover.office_lockable
features:
  - type: cover-open-close
  - type: cover-position
  - type: custom:lockable-cover-feature
    # lock_entity: switch.xxx   # optional; else read from the `lock_entity` attr
```

### Standalone (any cover, explicit lock entity)

If you are not using the `cover_lock` integration, point `lock_entity` at any
toggleable entity (a `switch`, `input_boolean` or `lock`):

```yaml
type: custom:lockable-cover-card
entity: cover.living_room_blind
name: Living Room
lock_entity: input_boolean.living_room_blind_lock
```

## Configuration options

| Option        | Type    | Required | Description                                                                                                  |
| ------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `entity`      | string  | yes      | The cover entity to display (must start with `cover.`).                                                       |
| `name`        | string  | no       | Display name, forwarded to the native tile card.                                                              |
| `lock_entity` | string  | no       | Entity toggled by the lock chip. If omitted, it is read from the cover's `lock_entity` attribute (`cover_lock`). |
| `features`    | list    | no       | Override the tile features. If omitted, derived from the cover's `supported_features` (blinds get a tilt slider). |

Any other options are forwarded to the underlying native tile card.

The lock chip is **hidden** when no lock entity can be determined. While locked,
the chip (or feature button) turns red and shows a `mdi:lock` icon; otherwise it
shows `mdi:lock-open-variant`.

## Companion integration (`cover_lock`)

The optional **`cover_lock`** integration lives in its own repository:
[`neffez/lockable-cover`](https://github.com/neffez/lockable-cover). It creates
a proxy cover that actually **blocks movement** while locked (from any source:
UI, automation, app, voice). The card automatically reads the proxy's `locked`
and `lock_entity` attributes, so you don't need to configure `lock_entity` when
pairing the two.

> **Note on HACS:** A HACS repository maps to exactly one category. This repo is
> published as a **Dashboard (plugin)** for the card; the integration is a
> separate **Integration** repository. Install the integration from
> [`neffez/lockable-cover`](https://github.com/neffez/lockable-cover) via HACS
> (custom repository, category Integration) and restart Home Assistant.

## License

[MIT](LICENSE)

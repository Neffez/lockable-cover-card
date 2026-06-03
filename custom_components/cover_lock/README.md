# Cover Lock

A small custom integration + Lovelace card that adds a **lock** to a cover,
shown directly on the card.

## What it does

`cover_lock` creates a proxy cover entity that mirrors an existing cover
(state, position, tilt, supported features) but **blocks all movement
commands while a lock entity is `on`** — no matter the source (UI, automation,
app, voice). `stop` is always allowed as a safety measure.

The companion card `lockable-cover-card` renders the open/stop/close controls plus
a position slider and a lock toggle on the card itself.

## Backend setup (YAML)

```yaml
# configuration.yaml
cover:
  - platform: cover_lock
    covers:
      office_lockable:
        name: "Office"
        cover_entity: cover.office_rollladen
        lock_entity: switch.office_beschattung_sperren   # switch / input_boolean / lock
        invert: true   # optional: lock entity is ON when *unlocked*
```

`invert: true` is for release-style lock objects where `on`/`1` means
*released/free* and `off`/`0` means *locked* (typical for KNX shading-release
group objects). Default is `false` (on = locked).

The config slug becomes the entity_id, so this creates `cover.office_lockable`
named "Office". Extra attributes exposed: `locked`, `lock_entity`,
`source_entity`.

## Frontend

The JS module is registered via `frontend.extra_module_url` in this repo and
provides two options.

### A) Corner lock chip — wrapper card (recommended)

`lockable-cover-card` renders a native tile and overlays a small lock chip in the
top-right corner. No extra row is used:

```yaml
type: custom:lockable-cover-card
entity: cover.office_lockable
name: Office
features:
  - type: cover-open-close
  - type: cover-position
# lock_entity: switch.xxx   # optional; auto-read from the proxy attribute
```

### B) Lock as a feature row — tile feature

`lockable-cover-feature` adds the lock as its own button row to the stock tile
card. Simpler to add via the tile UI editor, but it occupies a full row:

```yaml
type: tile
entity: cover.office_lockable
features:
  - type: cover-open-close
  - type: cover-position
  - type: custom:lockable-cover-feature
```

Both turn the lock red while locked, read the `locked` attribute from the
`cover_lock` proxy, and toggle the configured (or attribute-provided) lock
entity. For a plain cover, set `lock_entity` explicitly.

## Notes

- This lives in `custom_components/` and is loaded by Home Assistant directly;
  HACS is not required. To distribute via HACS, publish as a HACS integration
  repository with a root `hacs.json`.
- A full restart is required after adding the integration. Reload alone is not
  enough for a new platform.

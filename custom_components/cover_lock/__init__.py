"""Cover Lock integration.

Wraps an existing cover entity and a lock entity (switch / input_boolean /
lock). While the lock entity is "on" (locked), all movement commands
(open, close, set position, tilt) are blocked — regardless of whether the
command comes from the UI, an automation or an app. Stop is always allowed.

Configured via the `cover:` platform in YAML, e.g.:

cover:
  - platform: cover_lock
    covers:
      office:
        name: "Office"
        cover_entity: cover.office
        lock_entity: switch.office_beschattung_sperren
"""

DOMAIN = "cover_lock"

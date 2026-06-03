"""Lockable cover platform for the Cover Lock integration."""

from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.components.cover import (
    ATTR_POSITION,
    ATTR_TILT_POSITION,
    DEVICE_CLASSES_SCHEMA,
    PLATFORM_SCHEMA,
    CoverEntity,
)
from homeassistant.const import (
    ATTR_ENTITY_ID,
    CONF_DEVICE_CLASS,
    CONF_NAME,
    STATE_CLOSED,
    STATE_CLOSING,
    STATE_ON,
    STATE_OPENING,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import HomeAssistant, callback
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.event import async_track_state_change_event

_LOGGER = logging.getLogger(__name__)

CONF_COVERS = "covers"
CONF_COVER_ENTITY = "cover_entity"
CONF_LOCK_ENTITY = "lock_entity"
CONF_INVERT = "invert"

ATTR_LOCKED = "locked"
ATTR_LOCK_ENTITY = "lock_entity"
ATTR_SOURCE_ENTITY = "source_entity"

COVER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_COVER_ENTITY): cv.entity_id,
        vol.Required(CONF_LOCK_ENTITY): cv.entity_id,
        vol.Optional(CONF_NAME): cv.string,
        vol.Optional(CONF_DEVICE_CLASS): DEVICE_CLASSES_SCHEMA,
        # invert: True if the lock entity is ON when *unlocked* (e.g. a KNX
        # release object where 1 = released/free, 0 = locked).
        vol.Optional(CONF_INVERT, default=False): cv.boolean,
    }
)

PLATFORM_SCHEMA = PLATFORM_SCHEMA.extend(
    {
        vol.Required(CONF_COVERS): cv.schema_with_slug_keys(COVER_SCHEMA),
    }
)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up lockable covers from YAML configuration."""
    entities = [
        LockableCover(object_id, cfg) for object_id, cfg in config[CONF_COVERS].items()
    ]
    async_add_entities(entities)


class LockableCover(CoverEntity):
    """A cover that proxies a source cover but blocks movement while locked."""

    _attr_should_poll = False

    def __init__(self, object_id: str, cfg: dict) -> None:
        self._object_id = object_id
        self._cover_entity = cfg[CONF_COVER_ENTITY]
        self._lock_entity = cfg[CONF_LOCK_ENTITY]
        self._invert = cfg[CONF_INVERT]
        self._attr_name = cfg.get(CONF_NAME, object_id)
        self._attr_unique_id = f"cover_lock_{object_id}"
        self._device_class_override = cfg.get(CONF_DEVICE_CLASS)
        # Force the entity_id from the config slug so it is predictable
        # (e.g. "buro_lockable" -> cover.buro_lockable) instead of being
        # derived from the friendly name (which would collide with the source).
        self.entity_id = f"cover.{object_id}"

    async def async_added_to_hass(self) -> None:
        if self.hass.states.get(self._cover_entity) is None:
            _LOGGER.warning(
                "cover_lock '%s': source cover '%s' not found — check the "
                "entity_id under Developer Tools → States",
                self.entity_id,
                self._cover_entity,
            )

        @callback
        def _state_listener(event) -> None:
            self.async_write_ha_state()

        self.async_on_remove(
            async_track_state_change_event(
                self.hass,
                [self._cover_entity, self._lock_entity],
                _state_listener,
            )
        )

    # --- helpers -----------------------------------------------------------

    @property
    def _source(self):
        return self.hass.states.get(self._cover_entity)

    @property
    def _locked(self) -> bool:
        st = self.hass.states.get(self._lock_entity)
        if st is None or st.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
            return False
        is_on = st.state == STATE_ON
        # When inverted, ON means "released" -> locked is the opposite.
        return (not is_on) if self._invert else is_on

    def _src_attr(self, attr, default=None):
        src = self._source
        if src is None:
            return default
        return src.attributes.get(attr, default)

    # --- entity properties -------------------------------------------------

    @property
    def available(self) -> bool:
        # Mirror the source: only unavailable when the source is missing or
        # explicitly unavailable. A transient "unknown" (e.g. before the first
        # KNX state feedback) should not make the proxy unavailable.
        src = self._source
        return src is not None and src.state != STATE_UNAVAILABLE

    @property
    def device_class(self):
        return self._device_class_override or self._src_attr("device_class")

    @property
    def supported_features(self):
        return self._src_attr("supported_features", 0)

    @property
    def current_cover_position(self):
        return self._src_attr("current_position")

    @property
    def current_cover_tilt_position(self):
        return self._src_attr("current_tilt_position")

    @property
    def is_closed(self):
        src = self._source
        if src is None:
            return None
        pos = self.current_cover_position
        if pos is not None:
            return pos == 0
        return src.state == STATE_CLOSED

    @property
    def is_opening(self) -> bool:
        src = self._source
        return src is not None and src.state == STATE_OPENING

    @property
    def is_closing(self) -> bool:
        src = self._source
        return src is not None and src.state == STATE_CLOSING

    @property
    def extra_state_attributes(self):
        return {
            ATTR_LOCKED: self._locked,
            ATTR_LOCK_ENTITY: self._lock_entity,
            ATTR_SOURCE_ENTITY: self._cover_entity,
        }

    # --- command forwarding ------------------------------------------------

    async def _forward(self, service: str, **data) -> None:
        await self.hass.services.async_call(
            "cover",
            service,
            {ATTR_ENTITY_ID: self._cover_entity, **data},
            blocking=True,
            context=self._context,
        )

    def _blocked(self, action: str) -> bool:
        if self._locked:
            _LOGGER.debug(
                "%s is locked (%s on) — ignoring %s",
                self.entity_id,
                self._lock_entity,
                action,
            )
            return True
        return False

    async def async_open_cover(self, **kwargs) -> None:
        if self._blocked("open_cover"):
            return
        await self._forward("open_cover")

    async def async_close_cover(self, **kwargs) -> None:
        if self._blocked("close_cover"):
            return
        await self._forward("close_cover")

    async def async_stop_cover(self, **kwargs) -> None:
        # Stop is always allowed as a safety measure.
        await self._forward("stop_cover")

    async def async_set_cover_position(self, **kwargs) -> None:
        if self._blocked("set_cover_position"):
            return
        await self._forward("set_cover_position", **{ATTR_POSITION: kwargs[ATTR_POSITION]})

    async def async_open_cover_tilt(self, **kwargs) -> None:
        if self._blocked("open_cover_tilt"):
            return
        await self._forward("open_cover_tilt")

    async def async_close_cover_tilt(self, **kwargs) -> None:
        if self._blocked("close_cover_tilt"):
            return
        await self._forward("close_cover_tilt")

    async def async_stop_cover_tilt(self, **kwargs) -> None:
        await self._forward("stop_cover_tilt")

    async def async_set_cover_tilt_position(self, **kwargs) -> None:
        if self._blocked("set_cover_tilt_position"):
            return
        await self._forward(
            "set_cover_tilt_position", **{ATTR_TILT_POSITION: kwargs[ATTR_TILT_POSITION]}
        )

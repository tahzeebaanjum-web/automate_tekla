# role_classifier.py
#
# SINGLE SOURCE OF TRUTH for structural-member role classification.
#
# Both structure_engine.py (used by the dashboard summary / audit / agent)
# and graph_builder.py (used by the BIM Network Graph) import classify_role
# from here, so a member is always classified the same way everywhere in
# the app. This file is the only place that decides what counts as a
# COLUMN, BEAM, SECONDARY member, or UNKNOWN.
#
# Classification priority (highest -> lowest):
#   1. Explicit SECONDARY name hints  — "WALL", "ANCHOR", "BRACE", etc.
#   2. Small-plate / embed override   — PL-family profile + short length
#   3. Geometry                       — vertical vs horizontal, from
#                                        StartPoint/EndPoint deltas
#   4. Type / Name (within the geometry branch chosen above)
#   5. Profile family                 — HEA/HEB/UC for columns,
#                                        IPE/UB for beams, ...
#   6. Material                       — structural material as a
#                                        last-resort signal for verticals
#   7. UNKNOWN                        — if nothing above matches confidently
#
# Returns one of: "PRIMARY_COLUMN", "PRIMARY_BEAM", "SECONDARY", "UNKNOWN"
# (graph_builder.py maps PRIMARY_COLUMN -> COLUMN and PRIMARY_BEAM -> BEAM
#  for display, since the frontend's role labels don't use the PRIMARY_ prefix.)

import re


def _get_point(obj: dict, key: str) -> dict:
    """Case-insensitive point lookup (handles StartPoint / startPoint)."""
    return obj.get(key) or obj.get(key.lower()) or {}


def safe_str(x) -> str:
    return str(x or "").upper().strip()


def safe_length_mm(obj: dict):
    """
    Best-effort numeric length in mm, or None if missing/unparseable.
    Handles raw numbers (160), numeric strings ("160"), and strings with
    units ("160 mm", "160mm").

    Tekla's export schema nests length under Geometry.Length rather than
    at the top level of the member object — top-level Length/length is
    checked first for backward compatibility with other possible export
    shapes, then Geometry.Length/length is used as the real-world fallback.
    """
    raw = obj.get("Length")
    if raw is None:
        raw = obj.get("length")
    if raw is None:
        geo = obj.get("Geometry") or {}
        raw = geo.get("Length")
        if raw is None:
            raw = geo.get("length")
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    match = re.search(r"[\d.]+", str(raw))
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def is_vertical_member(obj: dict):
    """
    Returns True/False for vertical/horizontal, or None if indeterminate
    (e.g. start == end, or points missing).
    """
    start = _get_point(obj, "StartPoint")
    end   = _get_point(obj, "EndPoint")

    if not start or not end:
        return None

    dx = abs(start.get("X", 0) - end.get("X", 0))
    dy = abs(start.get("Y", 0) - end.get("Y", 0))
    dz = abs(start.get("Z", 0) - end.get("Z", 0))

    if dx == 0 and dy == 0 and dz == 0:
        return None  # null / zero-length geometry — can't decide

    return dz > dx and dz > dy


# Profile families
_COLUMN_PROFILES = {"PL", "HEB", "HEA", "UC", "CHS", "RHS", "SHS", "W"}
_BEAM_PROFILES    = {"UB", "IPE", "ISA", "IPN", "UBP", "D22"}
_SECONDARY_PROFILES = {"L", "C"}  # angles / channels — typically bracing, purlins, girts

# Material root strings that indicate structural material. Matched as a
# SUBSTRING of the member's Material field (not exact-equality) so that
# Tekla's "<MATERIAL>_UNDEFINED" suffix variants (e.g. "Steel_Undefined",
# "Concrete_Undefined") are caught the same way the bare grade names are,
# without having to hand-enumerate every "_Undefined" combination.
_STRUCT_MATERIAL_ROOTS = ("STEEL", "CONCRETE", "M30", "M25", "M20", "A36", "S275", "S355")

_SECONDARY_NAME_HINTS = ("WALL", "ANCHOR", "SLEEVE", "BRACE", "PURLIN", "GIRT")

# Below this length, a PL-family "column-shaped" profile is much more
# likely to be an embed plate, base plate, or connector/stiffener than an
# actual structural column — these are routinely modeled with vertical
# Start/End points in Tekla even though they aren't load-bearing columns.
_PLATE_EMBED_MAX_LENGTH_MM = 300


def classify_role(obj: dict) -> str:
    """
    Classifies a single Tekla member object into one of:
    PRIMARY_COLUMN, PRIMARY_BEAM, SECONDARY, UNKNOWN.
    """
    if not isinstance(obj, dict):
        return "UNKNOWN"

    name     = safe_str(obj.get("Name"))
    profile  = safe_str(obj.get("Profile"))
    material = safe_str(obj.get("Material"))
    type_val = safe_str(obj.get("Type"))
    dir_val  = safe_str(obj.get("Direction"))
    length   = safe_length_mm(obj)

    vertical = is_vertical_member(obj)

    # ── 1. Name-based SECONDARY override (highest priority) ─────────────
    # Tekla's Type/Direction fields describe geometric shape only
    # ("BEAM" = a linear horizontal element), not structural intent.
    # A precast wall panel, anchor bolt, or sleeve is geometrically a
    # "beam" in Tekla's eyes but is NOT a primary structural beam — so
    # an explicit name hint must win over Type/Profile fallbacks below.
    if any(h in name for h in _SECONDARY_NAME_HINTS):
        return "SECONDARY"

    # ── 2. Small-plate / embed override ──────────────────────────────────
    # A short PL-family member (base plate, embed plate, stiffener,
    # connector) is routinely modeled as a short vertical or near-vertical
    # segment in Tekla, which would otherwise satisfy the column-profile
    # check below. Guard with "COLUMN" not in name so an explicitly named
    # short column isn't misclassified.
    if (
        profile.startswith("PL")
        and length is not None
        and length < _PLATE_EMBED_MAX_LENGTH_MM
        and "COLUMN" not in name
    ):
        return "SECONDARY"

    # ── 3. Geometry indeterminate → fall back to name/type/profile only ──
    if vertical is None:
        if "COLUMN" in name or "COLUMN" in type_val or "VERTICAL" in dir_val:
            return "PRIMARY_COLUMN"
        if "BEAM" in name or "BEAM" in type_val or "HORIZONTAL" in dir_val:
            return "PRIMARY_BEAM"
        if any(p in profile for p in _COLUMN_PROFILES) and "COLUMN" in name:
            return "PRIMARY_COLUMN"
        if any(p in profile for p in _BEAM_PROFILES):
            return "PRIMARY_BEAM"
        return "UNKNOWN"

    # ── 4. Geometry says VERTICAL ────────────────────────────────────────
    # Note: deliberately does NOT check for "BEAM" in name/type here.
    # When geometry says vertical, this member is treated as a column
    # candidate regardless of what the Name field says — Tekla member
    # names are frequently copy-pasted/mislabeled (e.g. a vertical member
    # literally named "BEAM"), and geometry is a more reliable signal
    # than a free-text name field for primary axis intent.
    if vertical:
        if "COLUMN" in name or "COLUMN" in type_val:
            return "PRIMARY_COLUMN"
        if any(p in profile for p in _COLUMN_PROFILES):
            return "PRIMARY_COLUMN"
        # Material fallback (substring match — see _STRUCT_MATERIAL_ROOTS
        # comment above for why this isn't an exact-equality check).
        if any(root in material for root in _STRUCT_MATERIAL_ROOTS):
            return "PRIMARY_COLUMN"

    # ── 5. Geometry says HORIZONTAL ───────────────────────────────────────
    if not vertical:
        if "BEAM" in name or "GIRDER" in name or "BEAM" in type_val:
            return "PRIMARY_BEAM"
        if any(p in profile for p in _BEAM_PROFILES):
            return "PRIMARY_BEAM"
        # No material fallback for beams: an unnamed, unprofiled horizontal
        # element with no name/type/profile signal is left as UNKNOWN
        # rather than guessed as a beam.

    # ── 6. Secondary by profile family (angles/channels — bracing etc.) ──
    if any(profile.startswith(p) for p in _SECONDARY_PROFILES) and "COLUMN" not in name:
        return "SECONDARY"

    # ── 7. Nothing matched confidently ───────────────────────────────────
    return "UNKNOWN"
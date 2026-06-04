# structure_engine.py

def _get_point(obj: dict, key: str) -> dict:
    """Case-insensitive point lookup (handles StartPoint / startPoint)."""
    return obj.get(key) or obj.get(key.lower()) or {}


def safe_str(x) -> str:
    return str(x or "").upper().strip()


def is_vertical_member(obj: dict) -> bool:
    start = _get_point(obj, "StartPoint")
    end   = _get_point(obj, "EndPoint")

    if start is None or end is None:
        return False

    dx = abs(start.get("X", 0) - end.get("X", 0))
    dy = abs(start.get("Y", 0) - end.get("Y", 0))
    dz = abs(start.get("Z", 0) - end.get("Z", 0))

    # If all deltas are zero (null points) we can't decide — treat as unknown
    if dx == 0 and dy == 0 and dz == 0:
        return None   # None = "indeterminate"

    return dz > dx and dz > dy


# Profile families
_COLUMN_PROFILES  = {"PL", "HEB", "HEA", "UC", "CHS", "RHS", "SHS"}
_BEAM_PROFILES    = {"UB", "IPE", "ISA", "IPN", "HEA", "HEB", "UBP", "D22"}

# Material strings that are structural (not paint finish etc.)
_STRUCT_MATERIALS = {"STEEL", "STEEL_UNDEFINED", "CONCRETE", "M30", "M25", "M20", "A36", "S275", "S355"}


def classify_role(obj: dict) -> str:
    if not isinstance(obj, dict):
        return "UNKNOWN"

    name     = safe_str(obj.get("Name"))
    profile  = safe_str(obj.get("Profile"))
    material = safe_str(obj.get("Material"))

    vertical = is_vertical_member(obj)

    # ── Null / PolyBeam with no geometry ────────────────────────────────
    # startPoint / endPoint both null → can't determine orientation
    if vertical is None:
        # Fall back to name/profile hints only
        if any(p in profile for p in _COLUMN_PROFILES) and "COLUMN" in name:
            return "PRIMARY_COLUMN"
        if any(p in profile for p in _BEAM_PROFILES):
            return "PRIMARY_BEAM"
        if "WALL" in name or "ANCHOR" in name or "SLEEVE" in name:
            return "SECONDARY"
        return "UNKNOWN"

    # ── COLUMN ──────────────────────────────────────────────────────────
    if vertical:
        # Geometry says vertical — any column-ish profile or name confirms it
        if (
            "COLUMN" in name
            or any(p in profile for p in _COLUMN_PROFILES)
        ):
            return "PRIMARY_COLUMN"

        # Material alone is NOT enough for a COLUMN — too many false positives
        # (a horizontal M30 rebar is not a column).  Require at least a name hint.
        if material in _STRUCT_MATERIALS and ("COL" in name or "PILLAR" in name):
            return "PRIMARY_COLUMN"

        # Vertical + structural material but no column name → still a column
        # (generic steel column with no name tag)
        if material in _STRUCT_MATERIALS:
            return "PRIMARY_COLUMN"

    # ── BEAM ────────────────────────────────────────────────────────────
    if not vertical:
        if (
            "BEAM" in name
            or "GIRDER" in name
            or any(p in profile for p in _BEAM_PROFILES)
        ):
            return "PRIMARY_BEAM"

    # ── SECONDARY ───────────────────────────────────────────────────────
    if (
        "WALL"   in name
        or "ANCHOR" in name
        or "SLEEVE" in name
        or "BRACE"  in name
        or "PURLIN" in name
        or "GIRT"   in name
    ):
        return "SECONDARY"

    # ── Anything left ───────────────────────────────────────────────────
    return "UNKNOWN"


def build_structural_model(data) -> dict:
    result = {
        "PRIMARY_COLUMN": [],
        "PRIMARY_BEAM":   [],
        "SECONDARY":      [],
        "UNKNOWN":        [],
    }

    if isinstance(data, dict):
        elements = data.get("data") or data.get("elements") or []
    else:
        elements = data or []

    for obj in elements:
        if not isinstance(obj, dict):
            continue
        role = classify_role(obj)
        result[role].append(obj)

    return result
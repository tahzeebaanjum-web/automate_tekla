# connection_engine.py
#
# Converts the raw geometric edges from graph_builder.build_graph() into
# labeled ENGINEERING relationships. A raw edge only says "these two
# members' endpoints are within 50mm of each other" — it doesn't say
# *how* they relate structurally. This module adds that meaning, so the
# AI Engineer (and, later, the Connection panel / clash detection) can
# reason about the model instead of just counting members.
#
# Relationship types produced:
#   SUPPORTS       — a column holds up a beam/secondary member that
#                     meets it at the column's TOP end
#   SUPPORTED_BY    — inverse of SUPPORTS (for the supported member's view)
#   FRAMES_INTO     — a beam/secondary member's end meets another beam
#                     (beam-to-beam connection, e.g. a secondary framing
#                     into a primary beam)
#   BRACED_BY       — a SECONDARY member (brace) connects a column/beam
#                     to another column/beam at a non-end point pattern
#   CONNECTED_TO    — fallback label when geometry doesn't clearly imply
#                     a direction (e.g. column-to-column, or ambiguous)
#
# This module is intentionally conservative: when the relationship is
# ambiguous, it falls back to CONNECTED_TO rather than guessing. Wrong
# engineering claims are worse than a generic label.

from graph_builder import build_graph

SNAP_MM = 50.0


def _is_top_end(node: dict, point: dict) -> bool:
    """True if `point` (a start/end coordinate) is the higher-Z end of the member."""
    z_start = node["start"]["z"]
    z_end   = node["end"]["z"]
    return abs(point["z"] - max(z_start, z_end)) < 1e-6


def _dist(a: dict, b: dict) -> float:
    return ((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2 + (a["z"] - b["z"]) ** 2) ** 0.5


def _classify_edge(a: dict, b: dict) -> tuple:
    """
    Given two connected nodes (from graph_builder's node schema), determine
    the directional relationship between them.

    Returns (relationship_from_a_to_b, relationship_from_b_to_a).
    """
    a_role, b_role = a["role"], b["role"]

    # ── COLUMN <-> BEAM: column supports the beam if the beam's endpoint
    # meets the column at its TOP. Only BEAMs are "supported" this way —
    # a SECONDARY member touching a column's top is bracing, not being
    # carried by it, so it's excluded here and handled below.
    if a_role == "COLUMN" and b_role == "BEAM":
        meets_at_top = _is_top_end(a, a["end"]) or _is_top_end(a, a["start"])
        if meets_at_top:
            return ("SUPPORTS", "SUPPORTED_BY")
        return ("CONNECTED_TO", "CONNECTED_TO")

    if b_role == "COLUMN" and a_role == "BEAM":
        rel = _classify_edge(b, a)
        return (rel[1], rel[0])

    # ── BEAM <-> BEAM: beam-to-beam framing connection ──────────────────
    if a_role == "BEAM" and b_role == "BEAM":
        return ("FRAMES_INTO", "FRAMES_INTO")

    # ── SECONDARY involved with BEAM or COLUMN → always bracing, never
    #    "supported" — a brace transfers lateral/stability load, it
    #    doesn't carry the primary member's gravity load like a column
    #    under a beam does. ──────────────────────────────────────────────
    if a_role == "SECONDARY" and b_role in ("BEAM", "COLUMN"):
        return ("BRACES", "BRACED_BY")
    if b_role == "SECONDARY" and a_role in ("BEAM", "COLUMN"):
        rel = _classify_edge(b, a)
        return (rel[1], rel[0])

    # ── Anything else (column-column, secondary-secondary, unknowns) ────
    return ("CONNECTED_TO", "CONNECTED_TO")


def build_connections(data: list) -> dict:
    """
    Builds a labeled connection map from raw Tekla member data.

    Returns:
        {
            "by_member": {
                "<member_id>": [
                    {"with": "<other_id>", "relationship": "SUPPORTS", "other_role": "BEAM", "other_name": "..."},
                    ...
                ],
                ...
            },
            "relationships": [
                {"source": "...", "target": "...", "type": "SUPPORTS"},
                ...
            ],
            "counts": {"SUPPORTS": n, "FRAMES_INTO": n, "BRACES": n, "CONNECTED_TO": n},
            "nodes_by_id": { "<id>": <node dict from graph_builder> }   # for lookups
        }
    """
    graph = build_graph(data)
    nodes_by_id = {n["id"]: n for n in graph["nodes"]}

    by_member = {n["id"]: [] for n in graph["nodes"]}
    relationships = []
    counts = {}

    for e in graph["edges"]:
        a = nodes_by_id.get(e["source"])
        b = nodes_by_id.get(e["target"])
        if not a or not b:
            continue

        rel_a_to_b, rel_b_to_a = _classify_edge(a, b)

        by_member[a["id"]].append({
            "with": b["id"], "relationship": rel_a_to_b,
            "other_role": b["role"], "other_name": b["name"], "other_profile": b["profile"],
        })
        by_member[b["id"]].append({
            "with": a["id"], "relationship": rel_b_to_a,
            "other_role": a["role"], "other_name": a["name"], "other_profile": a["profile"],
        })

        relationships.append({"source": a["id"], "target": b["id"], "type": rel_a_to_b})
        counts[rel_a_to_b] = counts.get(rel_a_to_b, 0) + 1

    return {
        "by_member": by_member,
        "relationships": relationships,
        "counts": counts,
        "nodes_by_id": nodes_by_id,
    }


def find_member(data: list, query: str):
    """
    Looks up a member by id, name, or partial name/profile match.
    Used to resolve things like "Beam B-101" or "the roof beam" from a
    user's natural-language question into an actual member node.

    Returns the matching node dict (from graph_builder schema) or None.
    """
    graph = build_graph(data)
    q = query.strip().upper()
    if not q:
        return None

    # Exact id match first
    for n in graph["nodes"]:
        if n["id"] == q:
            return n

    # Exact name match
    for n in graph["nodes"]:
        if n["name"].upper() == q:
            return n

    # Partial match on id or name (e.g. "B-101" inside a longer label)
    for n in graph["nodes"]:
        if q in n["id"].upper() or q in n["name"].upper():
            return n

    return None


def describe_load_path(data: list, member_id: str, max_depth: int = 3) -> dict:
    """
    Walks the SUPPORTS chain downward from a given member to describe how
    load travels from it down to its foundations/supports.

    Returns:
        {
            "member": "<id>",
            "path": [
                {"id": "...", "role": "BEAM", "via": None},
                {"id": "...", "role": "COLUMN", "via": "SUPPORTED_BY"},
                ...
            ],
            "terminated": "foundation" | "max_depth" | "no_support"
        }
    """
    conn = build_connections(data)
    nodes_by_id = conn["nodes_by_id"]
    by_member = conn["by_member"]

    if member_id not in nodes_by_id:
        return {"member": member_id, "path": [], "terminated": "not_found"}

    path = [{"id": member_id, "role": nodes_by_id[member_id]["role"], "via": None}]
    current = member_id
    visited = {member_id}

    for _ in range(max_depth):
        # Find what supports the current member
        supporters = [
            r for r in by_member.get(current, [])
            if r["relationship"] == "SUPPORTED_BY" and r["with"] not in visited
        ]
        if not supporters:
            return {"member": member_id, "path": path, "terminated": "no_support"}

        nxt = supporters[0]["with"]
        path.append({"id": nxt, "role": nodes_by_id[nxt]["role"], "via": "SUPPORTED_BY"})
        visited.add(nxt)
        current = nxt

    return {"member": member_id, "path": path, "terminated": "max_depth"}
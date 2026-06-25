"""
graph_builder.py
─────────────────────────────────────────────────────────────────
Converts Tekla output.json  →  graph.json

graph.json schema
─────────────────
{
  "nodes": [
    {
      "id":       "1",           // member Id as string
      "label":    "COL-1",       // display name
      "role":     "COLUMN",      // COLUMN | BEAM | SECONDARY | UNKNOWN
      "profile":  "HEA200",
      "material": "S355",
      "length":   4000.0,        // mm
      "start":    {"x":0,"y":0,"z":0},
      "end":      {"x":0,"y":0,"z":4000},
      "mid":      {"x":0,"y":0,"z":2000}   // midpoint — used for node position
    }
  ],
  "edges": [
    {
      "id":     "e-1-2",
      "source": "1",   // node id
      "target": "2"    // node id
    }
  ],
  "meta": {
    "total":     50,
    "columns":   32,
    "beams":     7,
    "secondary": 3,
    "unknown":   8,
    "generated": "2026-06-20T01:33:35"
  }
}

Edge detection logic
────────────────────
Two members share an edge when an endpoint of one member is within
SNAP_MM millimetres of an endpoint of another member.
This is pure geometry — no assembly data needed.

Role classification
────────────────────
Uses the SAME classifier as structure_engine.py (imported from
role_classifier.py) so the BIM Network Graph and the dashboard
summary / KPI cards / audit panel always agree on member counts.
role_classifier.classify_role() returns PRIMARY_COLUMN / PRIMARY_BEAM /
SECONDARY / UNKNOWN; these are normalized to COLUMN / BEAM / SECONDARY /
UNKNOWN below to match the frontend's role labels (ROLE_META in App.js).
"""

import json
import math
import os
from datetime import datetime

from role_classifier import classify_role as _classify_role_raw

SNAP_MM = 50.0   # tolerance: endpoints closer than this → connected

_ROLE_DISPLAY_MAP = {
    "PRIMARY_COLUMN": "COLUMN",
    "PRIMARY_BEAM":   "BEAM",
    "SECONDARY":      "SECONDARY",
    "UNKNOWN":        "UNKNOWN",
}


def classify_role(m: dict) -> str:
    """
    Classifies a member and normalizes the result to the display-facing
    role labels used throughout the graph and the React frontend:
    COLUMN | BEAM | SECONDARY | UNKNOWN.
    """
    raw = _classify_role_raw(m)
    return _ROLE_DISPLAY_MAP.get(raw, "UNKNOWN")


# ── GEOMETRY HELPERS ────────────────────────────────────────────

def _pt(d: dict) -> tuple:
    return (float(d.get("X") or d.get("x") or 0),
            float(d.get("Y") or d.get("y") or 0),
            float(d.get("Z") or d.get("z") or 0))

def _mid(a: tuple, b: tuple) -> dict:
    return {"x": (a[0]+b[0])/2, "y": (a[1]+b[1])/2, "z": (a[2]+b[2])/2}

def _dist(a: tuple, b: tuple) -> float:
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)

def _length(a: tuple, b: tuple) -> float:
    return _dist(a, b)


# ── MAIN BUILDER ────────────────────────────────────────────────

def build_graph(data: list) -> dict:
    """
    Takes raw Tekla member list, returns graph dict with nodes + edges.
    """
    nodes = []
    # Store endpoints per node for edge detection
    endpoints = {}   # node_id → (start_tuple, end_tuple)

    for m in data:
        mid_str = str(m.get("Id", ""))
        if not mid_str:
            continue

        sp_raw = m.get("StartPoint") or m.get("startPoint") or {}
        ep_raw = m.get("EndPoint")   or m.get("endPoint")   or {}

        sp = _pt(sp_raw)
        ep = _pt(ep_raw)
        geo = m.get("Geometry") or {}
        length = float(geo.get("Length") or _length(sp, ep) or 0)

        role    = classify_role(m)
        profile = (m.get("Profile") or m.get("profile") or "???").strip()
        mat     = (m.get("Material") or m.get("material") or "").strip()
        name    = (m.get("Name") or m.get("name") or mid_str).strip()
        weight  = m.get("Weight") or m.get("weight") or 0
        drawing = m.get("Drawing") or m.get("drawing") or ""

        node = {
            "id":       mid_str,
            "label":    f"{role[:3]}-{mid_str}",
            "role":     role,
            "profile":  profile,
            "material": mat,
            "length":   round(length, 1),
            "weight":   weight,
            "drawing":  drawing,
            "start":    {"x": sp[0], "y": sp[1], "z": sp[2]},
            "end":      {"x": ep[0], "y": ep[1], "z": ep[2]},
            "mid":      _mid(sp, ep),
            "name":     name,
        }
        nodes.append(node)
        endpoints[mid_str] = (sp, ep)

    # ── Edge detection by shared endpoints ──────────────────────
    edges = []
    edge_set = set()
    ids = list(endpoints.keys())

    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a_id, b_id = ids[i], ids[j]
            a_pts = endpoints[a_id]   # (start, end)
            b_pts = endpoints[b_id]

            connected = False
            for pa in a_pts:
                for pb in b_pts:
                    if _dist(pa, pb) <= SNAP_MM:
                        connected = True
                        break
                if connected:
                    break

            if connected:
                key = tuple(sorted([a_id, b_id]))
                if key not in edge_set:
                    edge_set.add(key)
                    edges.append({
                        "id":     f"e-{a_id}-{b_id}",
                        "source": a_id,
                        "target": b_id,
                    })

    # ── Summary ─────────────────────────────────────────────────
    role_counts = {}
    for n in nodes:
        role_counts[n["role"]] = role_counts.get(n["role"], 0) + 1

    meta = {
        "total":     len(nodes),
        "columns":   role_counts.get("COLUMN", 0),
        "beams":     role_counts.get("BEAM", 0),
        "secondary": role_counts.get("SECONDARY", 0),
        "unknown":   role_counts.get("UNKNOWN", 0),
        "edges":     len(edges),
        "generated": datetime.now().isoformat(timespec="seconds"),
    }

    return {"nodes": nodes, "edges": edges, "meta": meta}


# ── CLI USAGE ────────────────────────────────────────────────────

if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    inp  = os.path.join(base, "output.json")
    out  = os.path.join(base, "graph.json")

    if not os.path.exists(inp):
        print(f"❌ output.json not found at {inp}")
        exit(1)

    with open(inp, "r", encoding="utf-8-sig") as f:
        data = json.load(f)

    graph = build_graph(data)

    with open(out, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2)

    m = graph["meta"]
    print(f"✅ graph.json generated")
    print(f"   Nodes : {m['total']}  (Columns:{m['columns']} Beams:{m['beams']} Secondary:{m['secondary']} Unknown:{m['unknown']})")
    print(f"   Edges : {m['edges']}")
    print(f"   Saved : {out}")
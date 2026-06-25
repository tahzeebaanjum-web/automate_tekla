from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

import json
import os
import time
import csv
import hashlib
import uuid

from structure_engine import build_structural_model, classify_role
from graph_builder import build_graph
from connection_engine import build_connections, find_member, describe_load_path

load_dotenv()

app = FastAPI(title="Tekla AI Pipeline")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── PATHS ────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON    = os.path.join(BASE_DIR, "output.json")
OUTPUT_CSV     = os.path.join(BASE_DIR, "model_export.csv")
MANIFEST_FILE  = os.path.join(BASE_DIR, "extraction_manifest.json")
GRAPH_JSON     = os.path.join(BASE_DIR, "graph.json")
PENDING_PROMPT = os.path.join(BASE_DIR, "pending_prompt.txt")

# ── FILE HELPERS ────────────────────────────────────────────────

def load_json() -> list:
    if not os.path.exists(OUTPUT_JSON):
        return []
    try:
        with open(OUTPUT_JSON, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except Exception:
        return []


def save_json(data: list) -> None:
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _hash_file(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _csv_member_count() -> int:
    if not os.path.exists(OUTPUT_CSV):
        return -1
    try:
        with open(OUTPUT_CSV, newline="", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            rows = list(reader)
        return max(0, len(rows) - 1)
    except Exception:
        return -1


def _summary(data: list, structured: dict) -> dict:
    try:
        conn = build_connections(data)
        connection_count = len(conn["relationships"])
    except Exception:
        connection_count = 0

    return {
        "total":       len(data),
        "columns":     len(structured["PRIMARY_COLUMN"]),
        "beams":       len(structured["PRIMARY_BEAM"]),
        "secondary":   len(structured["SECONDARY"]),
        "unknown":     len(structured["UNKNOWN"]),
        "connections": connection_count,
    }


# ── MODELS ──────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    message: str

class StructureRequest(BaseModel):
    model_data: list

class AgentRequest(BaseModel):
    command: str

class BuildRequest(BaseModel):
    prompt: str


# ── BASIC ROUTES ────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ── VERIFY ENDPOINT ─────────────────────────────────────────────

@app.get("/verify")
def verify():
    issues  = []
    details = {}
    now     = time.time()

    json_exists = os.path.exists(OUTPUT_JSON)
    json_count  = -1
    json_mtime  = None
    json_hash   = None

    if json_exists:
        data       = load_json()
        json_count = len(data)
        stat       = os.stat(OUTPUT_JSON)
        json_mtime = stat.st_mtime
        json_hash  = _hash_file(OUTPUT_JSON)
        details["json_members"]  = json_count
        details["json_modified"] = json_mtime
        details["json_hash"]     = json_hash
        details["export_age_seconds"] = round(now - json_mtime, 1)
    else:
        issues.append("output.json not found — run the C# extractor first")
        details["json_members"] = None

    csv_exists = os.path.exists(OUTPUT_CSV)
    csv_count  = -1

    if csv_exists:
        csv_count = _csv_member_count()
        details["csv_members"] = csv_count
        details["csv_hash"]    = _hash_file(OUTPUT_CSV)
    else:
        details["csv_members"] = None
        details["csv_note"]    = "model_export.csv not found (optional)"

    manifest_exists = os.path.exists(MANIFEST_FILE)
    manifest_count  = -1
    manifest_model  = "Unknown"

    if manifest_exists:
        try:
            with open(MANIFEST_FILE, "r", encoding="utf-8-sig") as f:
                manifest = json.load(f)
            manifest_count = manifest.get("member_count", -1)
            manifest_ts    = manifest.get("export_timestamp", None)
            manifest_model = manifest.get("model_name", "Unknown")
            manifest_hash  = manifest.get("json_hash", None)
            details["manifest_members"]   = manifest_count
            details["manifest_timestamp"] = manifest_ts
            details["manifest_model"]     = manifest_model

            if manifest_hash and json_hash and manifest_hash != json_hash:
                issues.append(
                    f"Hash mismatch: manifest expects {manifest_hash[:8]}… "
                    f"but output.json is {json_hash[:8]}…"
                )
                details["hash_mismatch"] = True
            else:
                details["hash_mismatch"] = False

        except Exception as ex:
            issues.append(f"Could not parse extraction_manifest.json: {ex}")
            details["manifest_members"] = None
    else:
        details["manifest_members"] = None
        details["manifest_note"]    = "extraction_manifest.json not found (optional)"

    counts = [c for c in [json_count, csv_count, manifest_count] if c >= 0]
    if len(counts) >= 2 and len(set(counts)) > 1:
        parts = []
        if json_count     >= 0: parts.append(f"JSON={json_count}")
        if csv_count      >= 0: parts.append(f"CSV={csv_count}")
        if manifest_count >= 0: parts.append(f"Manifest={manifest_count}")
        issues.append(f"Member count mismatch: {', '.join(parts)}")

    MAX_AGE = 3600
    if json_mtime and (now - json_mtime) > MAX_AGE:
        age_min = round((now - json_mtime) / 60)
        issues.append(f"Export is stale ({age_min} minutes old) — re-run extractor")
        details["stale"] = True
    else:
        details["stale"] = False

    # ── CHANGED: empty model is OK for verify — agent still works ──
    # Only hard-fail if output.json is missing entirely, not if it's empty.
    ok = json_exists and len([i for i in issues if "not found" in i or "mismatch" in i]) == 0

    return {
        "ok":           ok,
        "issues":       issues,
        "model_name":   manifest_model,
        "member_count": json_count if json_count >= 0 else None,
        "export_age":   details.get("export_age_seconds"),
        "details":      details,
        "suggestion":   None if ok else "Re-run the Tekla Extractor (dotnet run) and click Refresh",
    }


# ── MODEL ROUTES ─────────────────────────────────────────────────

@app.get("/tekla-pipeline")
def tekla_pipeline():
    data = load_json()
    if not data:
        return {"status": "error", "message": "No data in output.json"}
    structured = build_structural_model(data)
    return {"status": "success", "summary": _summary(data, structured)}


@app.get("/model-data")
def model_data():
    data = load_json()
    # Return empty but valid response when model is empty
    if not data:
        return {
            "status":  "success",
            "summary": {"total":0,"columns":0,"beams":0,"secondary":0,"connections":0,"unknown":0},
            "members": [],
            "edges":   [],
            "structured": {
                "PRIMARY_COLUMN": [], "PRIMARY_BEAM": [],
                "SECONDARY": [], "UNKNOWN": []
            },
        }

    structured = build_structural_model(data)
    graph = build_graph(data)

    return {
        "status":     "success",
        "summary":    _summary(data, structured),
        "members":    graph["nodes"],
        "edges":      graph["edges"],
        "structured": structured,
    }


@app.get("/drawings")
def get_drawings():
    drawings_file = os.path.join(BASE_DIR, "drawings.json")
    if os.path.exists(drawings_file):
        try:
            with open(drawings_file, "r", encoding="utf-8-sig") as f:
                return {"drawings": json.load(f)}
        except Exception:
            pass
    return {"drawings": []}


@app.get("/graph")
def get_graph():
    data = load_json()
    if not data:
        return {
            "status":  "success",
            "message": "Model is empty. Use Build Agent or run the C# extractor.",
            "nodes":   [],
            "edges":   [],
            "meta":    {},
        }

    graph = build_graph(data)

    try:
        with open(GRAPH_JSON, "w", encoding="utf-8") as f:
            json.dump(graph, f, indent=2)
    except Exception:
        pass

    return {
        "status": "success",
        **graph,
    }


@app.get("/connections")
def get_connections():
    data = load_json()
    if not data:
        return {
            "status":        "success",
            "relationships": [],
            "by_member":     {},
            "counts":        {},
        }

    conn = build_connections(data)

    return {
        "status":        "success",
        "relationships": conn["relationships"],
        "by_member":     conn["by_member"],
        "counts":        conn["counts"],
    }


@app.post("/create-structure")
def create_structure(req: StructureRequest):
    structured = build_structural_model(req.model_data)
    return {
        "status":  "success",
        "summary": _summary(req.model_data, structured),
        "data":    structured,
    }


@app.post("/upload-model")
async def upload_model(request: Request):
    try:
        body = await request.body()
        if body:
            data = json.loads(body)
            if isinstance(data, dict):
                data = data.get("data") or data.get("elements") or []
        else:
            data = load_json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")

    if not data:
        return {"status": "error", "message": "No model data received"}

    save_json(data)
    structured = build_structural_model(data)
    summary    = _summary(data, structured)

    print(f"\n✅ Model uploaded: {summary['total']} members")
    print(f"   Columns: {summary['columns']}  Beams: {summary['beams']}  "
          f"Secondary: {summary['secondary']}  Unknown: {summary['unknown']}\n")

    return {
        "status":  "success",
        "message": f"Model received and saved to {OUTPUT_JSON}",
        "summary": summary,
    }


# ── BUILD-IN-TEKLA ENDPOINTS ────────────────────────────────────

@app.post("/build-structure")
def build_structure_endpoint(req: BuildRequest):
    """
    Dashboard sends a natural-language prompt here.
    We save it to pending_prompt.txt so the running C# program.cs picks it up
    on its next polling cycle and physically creates the structure in Tekla.
    """
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    prompt = req.prompt.strip()

    try:
        with open(PENDING_PROMPT, "w", encoding="utf-8") as f:
            f.write(prompt)
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Could not save prompt: {ex}")

    print(f"\n🏗  Tekla build queued: {prompt}\n")

    return {
        "status":  "queued",
        "message": f"Prompt queued for Tekla: '{prompt}'. C# generator will pick it up within 2 seconds.",
        "prompt":  prompt,
    }


@app.get("/pending-prompt")
def get_pending_prompt():
    """
    C# program.cs polls this endpoint every 2 seconds.
    Returns the queued prompt once, then deletes the file.
    """
    if not os.path.exists(PENDING_PROMPT):
        return {"prompt": None}

    try:
        with open(PENDING_PROMPT, "r", encoding="utf-8") as f:
            prompt = f.read().strip()
        os.remove(PENDING_PROMPT)
        return {"prompt": prompt if prompt else None}
    except Exception:
        return {"prompt": None}


@app.get("/build-status")
def build_status():
    """Returns whether a build is currently pending."""
    pending = os.path.exists(PENDING_PROMPT)
    return {
        "pending": pending,
        "message": "Awaiting C# generator pickup" if pending else "No build pending",
    }


# ── QUERY ────────────────────────────────────────────────────────

@app.post("/query")
def query(req: QueryRequest):
    data = load_json()
    if not data:
        return {
            "status":   "success",
            "response": "The model is currently empty (0 members). Use the Build Agent to create members, or run the C# extractor to load an existing Tekla model.",
            "summary":  {"total":0,"columns":0,"beams":0,"secondary":0,"connections":0,"unknown":0},
            "resolved_member": None,
        }

    structured = build_structural_model(data)
    summary    = _summary(data, structured)
    msg        = req.message.strip()

    resolved_member = _resolve_member_from_text(data, msg)

    context_lines = [
        "MODEL SUMMARY",
        f"Total structural members: {summary['total']}",
        f"Primary columns: {summary['columns']}",
        f"Primary beams: {summary['beams']}",
        f"Secondary members: {summary['secondary']}",
        f"Unknown/unclassified: {summary['unknown']}",
    ]

    if resolved_member:
        conn = build_connections(data)
        mid  = resolved_member["id"]
        rels = conn["by_member"].get(mid, [])

        context_lines += [
            "",
            f"RESOLVED MEMBER: {mid} ({resolved_member['name']})",
            f"  Role: {resolved_member['role']}",
            f"  Profile: {resolved_member['profile']}",
            f"  Material: {resolved_member['material'] or 'not specified'}",
            f"  Length: {resolved_member['length']} mm",
            f"  Weight: {resolved_member.get('weight', 0)} kg",
            f"  Coordinates — start: {resolved_member['start']}, end: {resolved_member['end']}",
        ]

        if rels:
            context_lines.append(f"  Direct structural connections ({len(rels)}):")
            for r in rels:
                verb = {
                    "SUPPORTS":      "supports",
                    "SUPPORTED_BY":  "is supported by",
                    "FRAMES_INTO":   "frames into",
                    "BRACES":        "is braced by",
                    "BRACED_BY":     "is braced by",
                    "CONNECTED_TO":  "is connected to",
                }.get(r["relationship"], r["relationship"].lower())
                context_lines.append(
                    f"    - {verb} {r['with']} ({r['other_role']}, {r['other_profile']})"
                )
        else:
            context_lines.append("  No direct structural connections found.")

        lower_msg = msg.lower()
        if any(k in lower_msg for k in ("load path", "load-path", "support", "carries", "carrying")):
            lp = describe_load_path(data, mid)
            if lp["path"]:
                chain = " -> ".join(f"{s['id']} ({s['role']})" for s in lp["path"])
                context_lines.append(f"  Load path (downward to supports): {chain}")

    else:
        role_list = _resolve_role_list_from_text(data, msg)

        if role_list:
            role_label, members_list = role_list
            context_lines += [
                "",
                f"{role_label} MEMBERS IN THIS MODEL ({len(members_list)}):",
            ]
            for m in members_list[:30]:
                mid_str = str(m.get("Id", ""))
                context_lines.append(
                    f"  - ID:{mid_str} Name:{m.get('Name','')} Profile:{m.get('Profile','')} "
                    f"Material:{m.get('Material') or 'not specified'}"
                )
            if len(members_list) > 30:
                context_lines.append(f"  ... and {len(members_list) - 30} more {role_label.lower()} members")
        else:
            context_lines += ["", "Sample of first 10 members:"]
            for m in data[:10]:
                context_lines.append(
                    f"  - ID:{m.get('Id')} Type:{m.get('Type')} Profile:{m.get('Profile')} "
                    f"Material:{m.get('Material')} Name:{m.get('Name')}"
                )

    system_prompt = (
        "You are a structural engineering assistant embedded in a BIM dashboard. "
        "Answer using ONLY the model data provided below — never invent member IDs, "
        "profiles, or relationships that aren't in the context. "
        "If a specific member was resolved, ground your answer in its actual "
        "connections and role rather than giving a generic textbook definition. "
        "If a role-based member list is provided (e.g. 'SECONDARY MEMBERS IN THIS "
        "MODEL'), that list IS the complete answer for that role. "
        "Use exact numbers from the summary — do not estimate or guess. "
        "Only say you cannot answer if the relevant data is genuinely absent."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "\n".join(context_lines) + f"\n\nQUESTION: {msg}",
            },
        ],
    )

    return {
        "status":          "success",
        "response":        response.choices[0].message.content,
        "summary":         summary,
        "resolved_member": resolved_member["id"] if resolved_member else None,
    }


def _resolve_role_list_from_text(data: list, text: str):
    lower = text.lower()
    role_keywords = [
        ("secondary",    "SECONDARY",      "Secondary"),
        ("column",       "PRIMARY_COLUMN", "Column"),
        ("beam",         "PRIMARY_BEAM",   "Beam"),
        ("unknown",      "UNKNOWN",        "Unknown"),
        ("unclassified", "UNKNOWN",        "Unknown"),
    ]
    for kw, role_key, label in role_keywords:
        if kw in lower:
            matches = [m for m in data if classify_role(m) == role_key]
            return (label, matches)
    return None


def _resolve_member_from_text(data: list, text: str):
    import re
    candidates = re.findall(r"[A-Za-z]{1,6}-?\d{1,6}", text)
    for c in candidates:
        m = find_member(data, c)
        if m:
            return m

    text_upper = text.upper()
    best_match, best_len = None, 0
    for n in (data or []):
        name = (n.get("Name") or "").strip()
        if len(name.split()) >= 2 and name.upper() in text_upper:
            if len(name) > best_len:
                best_match, best_len = name, len(name)
    if best_match:
        return find_member(data, best_match)

    if len(text.split()) <= 4:
        return find_member(data, text)

    return None


# ── AGENT ────────────────────────────────────────────────────────

@app.post("/agent")
def agent(req: AgentRequest):
    data = load_json()
    structured = build_structural_model(data) if data else {
        "PRIMARY_COLUMN": [], "PRIMARY_BEAM": [], "SECONDARY": [], "UNKNOWN": []
    }
    cmd = req.command.strip().lower()

    # ── LIST ──────────────────────────────────────────────────────
    if cmd.startswith("list"):
        profiles  = list({m.get("Profile") or m.get("profile") for m in data if m.get("Profile") or m.get("profile")})
        materials = list({m.get("Material") or m.get("material") for m in data if m.get("Material") or m.get("material")})
        return {
            "status":    "success",
            "action":    "list",
            "profiles":  sorted(profiles),
            "materials": sorted(materials),
            "summary": {
                "total":     len(data),
                "columns":   len(structured["PRIMARY_COLUMN"]),
                "beams":     len(structured["PRIMARY_BEAM"]),
                "secondary": len(structured["SECONDARY"]),
                "unknown":   len(structured["UNKNOWN"]),
            },
        }

    # ── DELETE ────────────────────────────────────────────────────
    if cmd.startswith("delete"):
        role_map = {
            "unknown":   "UNKNOWN",
            "secondary": "SECONDARY",
            "beam":      "PRIMARY_BEAM",
            "beams":     "PRIMARY_BEAM",
            "column":    "PRIMARY_COLUMN",
            "columns":   "PRIMARY_COLUMN",
        }
        target_role = None
        for key, val in role_map.items():
            if key in cmd:
                target_role = val
                break

        if not target_role:
            return {"status": "error", "message": "Could not determine which members to delete."}

        before   = len(data)
        new_data = [m for m in data if classify_role(m) != target_role]
        save_json(new_data)
        removed = before - len(new_data)
        return {
            "status":    "success",
            "action":    "delete",
            "removed":   removed,
            "remaining": len(new_data),
            "message":   f"Deleted {removed} {target_role} members. {len(new_data)} remaining.",
        }

    # ── CREATE ────────────────────────────────────────────────────
    if cmd.startswith("create"):
        system = (
            "Parse a structural creation command and return ONLY valid JSON, no markdown. "
            "Schema: {count: int, type: 'BEAM'|'COLUMN', profile: str, material: str}. "
            "Defaults: profile='IPE300', material='S275'."
        )
        try:
            resp = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": req.command},
                ],
                max_tokens=100,
            )
            raw    = resp.choices[0].message.content.strip()
            raw    = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
        except Exception as ex:
            return {"status": "error", "message": f"Could not parse command: {ex}"}

        count    = int(parsed.get("count", 1))
        mem_type = parsed.get("type", "BEAM").upper()
        profile  = parsed.get("profile", "IPE300").upper()
        material = parsed.get("material", "S275").upper()

        if count < 1 or count > 100:
            return {"status": "error", "message": "Count must be between 1 and 100"}

        is_col      = mem_type == "COLUMN"
        new_members = []
        max_id      = max((m.get("Id") or 0 for m in data), default=0)

        for i in range(count):
            nid   = max_id + i + 1
            start = {"X": i * 1000.0, "Y": 0.0, "Z": 0.0}
            end   = {"X": i * 1000.0, "Y": 0.0, "Z": 3000.0} if is_col else {"X": (i + 1) * 1000.0, "Y": 0.0, "Z": 0.0}
            dx    = end["X"] - start["X"]
            dy    = end["Y"] - start["Y"]
            dz    = end["Z"] - start["Z"]
            length = (dx**2 + dy**2 + dz**2) ** 0.5
            new_members.append({
                "Id":        nid,
                "Guid":      str(uuid.uuid4()),
                "Type":      "COLUMN" if is_col else "BEAM",
                "Direction": "VERTICAL" if is_col else "HORIZONTAL",
                "Name":      mem_type,
                "Profile":   profile,
                "Material":  material,
                "Class":     "1",
                "Finish":    "",
                "StartPoint": start,
                "EndPoint":   end,
                "Geometry":  {"DeltaX": dx, "DeltaY": dy, "DeltaZ": dz, "Length": length},
            })

        data.extend(new_members)
        save_json(data)
        new_structured = build_structural_model(data)

        return {
            "status":      "success",
            "action":      "create",
            "created":     count,
            "type":        mem_type,
            "profile":     profile,
            "material":    material,
            "message":     f"Created {count} {mem_type}(s) with profile {profile}, material {material}.",
            "new_ids":     [m["Id"] for m in new_members],
            "total_after": len(data),
            "summary": {
                "columns":   len(new_structured["PRIMARY_COLUMN"]),
                "beams":     len(new_structured["PRIMARY_BEAM"]),
                "secondary": len(new_structured["SECONDARY"]),
                "unknown":   len(new_structured["UNKNOWN"]),
            },
        }

    # ── SUGGEST ──────────────────────────────────────────────────
    if "suggest" in cmd or "optimal" in cmd or "recommend" in cmd:
        structured2 = build_structural_model(data) if data else structured
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{
                "role": "user",
                "content": (
                    "You are a structural engineer. Based on this model summary, "
                    "suggest optimal steel sections and improvements.\n\n"
                    f"Columns: {len(structured2['PRIMARY_COLUMN'])}\n"
                    f"Beams: {len(structured2['PRIMARY_BEAM'])}\n"
                    f"Total: {len(data)}\n\n"
                    f"Command: {req.command}"
                ),
            }],
        )
        return {
            "status":   "success",
            "action":   "suggest",
            "response": response.choices[0].message.content,
        }

    # ── FALLBACK ─────────────────────────────────────────────────
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{
            "role": "user",
            "content": (
                f"Structural model has {len(data)} members. "
                f"Command: {req.command}\n"
                "If this is a creation/deletion/modification command, explain what you would do step by step."
            ),
        }],
    )
    return {
        "status":   "success",
        "action":   "ai_response",
        "response": response.choices[0].message.content,
    }
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

import json
import os

from structure_engine import build_structural_model

load_dotenv()

app = FastAPI(title="Tekla AI Pipeline")
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON = os.path.join(BASE_DIR, "output.json")


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


def _summary(data: list, structured: dict) -> dict:
    return {
        "total":     len(data),
        "columns":   len(structured["PRIMARY_COLUMN"]),
        "beams":     len(structured["PRIMARY_BEAM"]),
        "secondary": len(structured["SECONDARY"]),
        "unknown":   len(structured["UNKNOWN"]),
    }


class QueryRequest(BaseModel):
    message: str


class StructureRequest(BaseModel):
    model_data: list


@app.get("/")
def root():
    return {"status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/tekla-pipeline")
def tekla_pipeline():
    data = load_json()
    if not data:
        return {"status": "error", "message": "No data in output.json"}
    structured = build_structural_model(data)
    return {"status": "success", "summary": _summary(data, structured)}


@app.get("/model-data")
def model_data():
    """Returns full structured model — used by the frontend dashboard."""
    data = load_json()
    if not data:
        return {"status": "error", "message": "No data"}
    structured = build_structural_model(data)
    return {
        "status":    "success",
        "summary":   _summary(data, structured),
        "structured": structured,
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
    """
    Accepts the raw JSON array POSTed by program.cs.
    Falls back to output.json if body is empty.
    """
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
    print(f"   Columns: {summary['columns']}  Beams: {summary['beams']}  Secondary: {summary['secondary']}  Unknown: {summary['unknown']}\n")

    return {
        "status":  "success",
        "message": f"Model received and saved to {OUTPUT_JSON}",
        "summary": summary,
    }


@app.post("/query")
def query(req: QueryRequest):
    data = load_json()
    if not data:
        return {"status": "error", "message": "No model data. Run dotnet first."}

    structured = build_structural_model(data)
    summary    = _summary(data, structured)

    # Build a precise context so AI counts match exactly
    context_lines = [
        f"Total structural members: {summary['total']}",
        f"Primary columns: {summary['columns']}",
        f"Primary beams: {summary['beams']}",
        f"Secondary members: {summary['secondary']}",
        f"Unknown/unclassified: {summary['unknown']}",
        "",
        "Sample of first 10 members:",
    ]
    for m in data[:10]:
        context_lines.append(
            f"  - ID:{m.get('Id')} GUID:{m.get('Guid','')} "
            f"Type:{m.get('Type')} Profile:{m.get('Profile')} "
            f"Material:{m.get('Material')} Name:{m.get('Name')}"
        )

    system_prompt = (
        "You are a structural engineer assistant. "
        "Answer ONLY based on the data provided. "
        "Use exact numbers from the summary — do not estimate or guess. "
        "If the question is about counts, use the summary numbers directly."
    )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "MODEL SUMMARY:\n"
                    + "\n".join(context_lines)
                    + f"\n\nQUESTION: {req.message}"
                ),
            },
        ],
    )

    return {
        "status":   "success",
        "response": response.choices[0].message.content,
        "summary":  summary,
    }


# =========================
# CREATION AGENT
# =========================
class AgentRequest(BaseModel):
    command: str


@app.post("/agent")
def agent(req: AgentRequest):
    """
    Natural language creation agent.
    Understands commands like:
      create 3 beams IPE300 S275
      create 2 columns HEB200 S355
      delete all unknown members
      list all profiles
      suggest optimal sections
    """
    data = load_json()
    structured = build_structural_model(data)
    cmd = req.command.strip().lower()

    # ── LIST ────────────────────────────────────────────────────────
    if cmd.startswith("list"):
        profiles  = list({m.get("Profile") or m.get("profile") for m in data if m.get("Profile") or m.get("profile")})
        materials = list({m.get("Material") or m.get("material") for m in data if m.get("Material") or m.get("material")})
        return {
            "status": "success",
            "action": "list",
            "profiles":  sorted(profiles),
            "materials": sorted(materials),
            "summary":   {
                "total":     len(data),
                "columns":   len(structured["PRIMARY_COLUMN"]),
                "beams":     len(structured["PRIMARY_BEAM"]),
                "secondary": len(structured["SECONDARY"]),
                "unknown":   len(structured["UNKNOWN"]),
            },
        }

    # ── DELETE ──────────────────────────────────────────────────────
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
            return {"status": "error", "message": "Could not determine which members to delete. Try: delete all unknown members"}

        before = len(data)
        new_data = [
            m for m in data
            if build_structural_model([m]).get(target_role) == []
        ]
        # Simpler approach — use classify directly
        from structure_engine import classify_role
        new_data = [m for m in data if classify_role(m) != target_role]
        save_json(new_data)
        removed = before - len(new_data)
        return {
            "status":  "success",
            "action":  "delete",
            "removed": removed,
            "remaining": len(new_data),
            "message": f"Deleted {removed} {target_role} members. {len(new_data)} remaining.",
        }

    # ── CREATE ──────────────────────────────────────────────────────
    if cmd.startswith("create"):
        # Use Groq to parse the command into structured JSON
        system = (
            "Parse a structural creation command and return ONLY valid JSON, no markdown. "
            "Schema: {count: int, type: 'BEAM'|'COLUMN', profile: str, material: str}. "
            "Defaults: profile='IPE300', material='S275'. "
            "Example input: 'create 3 beams IPE300 S275' "
            "Example output: {\"count\":3,\"type\":\"BEAM\",\"profile\":\"IPE300\",\"material\":\"S275\"}"
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
            raw = resp.choices[0].message.content.strip()
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
        except Exception as ex:
            return {"status": "error", "message": f"Could not parse command: {ex}"}

        count    = int(parsed.get("count", 1))
        mem_type = parsed.get("type", "BEAM").upper()
        profile  = parsed.get("profile", "IPE300").upper()
        material = parsed.get("material", "S275").upper()

        if count < 1 or count > 100:
            return {"status": "error", "message": "Count must be between 1 and 100"}

        import uuid as _uuid
        is_col  = mem_type == "COLUMN"
        new_members = []
        max_id = max((m.get("Id") or 0 for m in data), default=0)

        for i in range(count):
            nid   = max_id + i + 1
            start = {"X": i * 1000.0, "Y": 0.0, "Z": 0.0}
            end   = {"X": i * 1000.0, "Y": 0.0, "Z": 3000.0} if is_col else {"X": (i + 1) * 1000.0, "Y": 0.0, "Z": 0.0}
            dx = end["X"] - start["X"]
            dy = end["Y"] - start["Y"]
            dz = end["Z"] - start["Z"]
            length = (dx**2 + dy**2 + dz**2) ** 0.5
            new_members.append({
                "Id":        nid,
                "Guid":      str(_uuid.uuid4()),
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
            "status":  "success",
            "action":  "create",
            "created": count,
            "type":    mem_type,
            "profile": profile,
            "material": material,
            "message": f"Created {count} {mem_type}(s) with profile {profile}, material {material}.",
            "new_ids": [m["Id"] for m in new_members],
            "total_after": len(data),
            "summary": {
                "columns":   len(new_structured["PRIMARY_COLUMN"]),
                "beams":     len(new_structured["PRIMARY_BEAM"]),
                "secondary": len(new_structured["SECONDARY"]),
                "unknown":   len(new_structured["UNKNOWN"]),
            },
        }

    # ── SUGGEST ─────────────────────────────────────────────────────
    if "suggest" in cmd or "optimal" in cmd or "recommend" in cmd:
        structured2 = build_structural_model(data)
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

    # ── FALLBACK — let AI handle it ──────────────────────────────────
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
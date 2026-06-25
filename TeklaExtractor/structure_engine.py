# structure_engine.py
#
# Classification logic now lives in role_classifier.py (shared with
# graph_builder.py) so the dashboard summary and the BIM Network Graph
# always agree on how members are classified. This file re-exports
# classify_role for backward compatibility with existing imports
# (e.g. `from structure_engine import classify_role`).

from role_classifier import classify_role  # noqa: F401  (re-exported)


def build_structural_model(data) -> dict:
    """
    Buckets raw Tekla member objects into role groups using the shared
    classifier. Returns a dict with keys:
        PRIMARY_COLUMN, PRIMARY_BEAM, SECONDARY, UNKNOWN
    """
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
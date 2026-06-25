using System;
using System.Collections.Generic;
using System.Linq;
using Tekla.Structures.Model;
using TeklaExtractor.Models;
using TSG = Tekla.Structures.Geometry3d;

namespace TeklaExtractor.AI
{
    public static class ModelAnalyzer
    {
        // ── Grid spacing — Tekla grid se match karo (mm mein) ─────────────────
        private const double GRID_SPACING = 5000.0;  // ← apne grid ke hisaab se badlo

        public static ModelContext Analyze(Model model)
        {
            var ctx = new ModelContext();

            try
            {
                var all = model.GetModelObjectSelector().GetAllObjects();

                var profiles  = new Dictionary<string, int>();
                var materials = new Dictionary<string, int>();

                double minX = double.MaxValue, minY = double.MaxValue, minZ = double.MaxValue;
                double maxX = double.MinValue, maxY = double.MinValue, maxZ = double.MinValue;

                bool anyBeam = false;

                while (all.MoveNext())
                {
                    var beam = all.Current as Beam;
                    if (beam == null) continue;

                    var s = beam.StartPoint;
                    var e = beam.EndPoint;

                    // ── Bounding box ──────────────────────────────────────────
                    minX = Math.Min(minX, Math.Min(s.X, e.X));
                    minY = Math.Min(minY, Math.Min(s.Y, e.Y));
                    minZ = Math.Min(minZ, Math.Min(s.Z, e.Z));
                    maxX = Math.Max(maxX, Math.Max(s.X, e.X));
                    maxY = Math.Max(maxY, Math.Max(s.Y, e.Y));
                    maxZ = Math.Max(maxZ, Math.Max(s.Z, e.Z));

                    // ── Member classification ─────────────────────────────────
                    double dz = Math.Abs(e.Z - s.Z);
                    double dx = Math.Abs(e.X - s.X);
                    double dy = Math.Abs(e.Y - s.Y);

                    bool isCol   = dz > dx && dz > dy;
                    bool isBrace = !isCol && (dx > 100 && dz > 100);

                    if (isCol)        ctx.Columns++;
                    else if (isBrace) ctx.Braces++;
                    else              ctx.Beams++;

                    ctx.TotalMembers++;
                    anyBeam = true;

                    // ── Profile count ─────────────────────────────────────────
                    string prof = beam.Profile?.ProfileString ?? "";
                    if (!string.IsNullOrEmpty(prof))
                        profiles[prof] = (profiles.TryGetValue(prof, out int pc) ? pc : 0) + 1;

                    // ── Material count ────────────────────────────────────────
                    string mat = beam.Material?.MaterialString ?? "";
                    if (!string.IsNullOrEmpty(mat))
                        materials[mat] = (materials.TryGetValue(mat, out int mc) ? mc : 0) + 1;
                }

                if (anyBeam)
                {
                    // ── Store bounding box ────────────────────────────────────
                    ctx.BoundingMinX = minX; ctx.BoundingMaxX = maxX;
                    ctx.BoundingMinY = minY; ctx.BoundingMaxY = maxY;
                    ctx.BoundingMinZ = minZ; ctx.BoundingMaxZ = maxZ;

                    // ── Grid-snapped origin: existing structure ke baad ───────
                    // X: grid origin pe hi rakho (0), Y mein aage badhao
                    double rawNextY = maxY + GRID_SPACING;
                    ctx.NextOriginX = 0;
                    ctx.NextOriginY = SnapToGrid(rawNextY, GRID_SPACING);
                    ctx.NextOriginZ = 0;

                    Console.WriteLine($"[Analyzer] Bounding box → " +
                                      $"X:[{minX},{maxX}] Y:[{minY},{maxY}] Z:[{minZ},{maxZ}]");
                    Console.WriteLine($"[Analyzer] maxY={maxY} → rawNextY={rawNextY} " +
                                      $"→ snapped NextOriginY={ctx.NextOriginY}");
                    Console.WriteLine($"[Analyzer] NextOrigin = " +
                                      $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");
                }
                else
                {
                    // ── Empty model: grid origin se shuru karo ────────────────
                    ctx.NextOriginX = 0;
                    ctx.NextOriginY = 0;
                    ctx.NextOriginZ = 0;
                    Console.WriteLine("[Analyzer] Empty model → starting at grid origin (0, 0, 0)");
                }

                // ── Dominant profile / material ───────────────────────────────
                ctx.DominantProfile  = profiles .OrderByDescending(x => x.Value)
                                                 .FirstOrDefault().Key ?? "";
                ctx.DominantMaterial = materials.OrderByDescending(x => x.Value)
                                                 .FirstOrDefault().Key ?? "";
                ctx.AllProfiles  = profiles .Keys.ToList();
                ctx.AllMaterials = materials.Keys.ToList();

                ctx.DetectedStructureType = DetectType(ctx);

                Console.WriteLine($"[Analyzer] Result → {ctx}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Analyzer] ERROR: {ex.Message}");
                // Safe fallback — grid origin pe
                ctx.NextOriginX = 0;
                ctx.NextOriginY = 0;
                ctx.NextOriginZ = 0;
            }

            return ctx;
        }

        // ── Grid snapping helper ───────────────────────────────────────────────
        // Value ko nearest upper grid line pe snap karta hai
        private static double SnapToGrid(double value, double gridSpacing)
        {
            if (gridSpacing <= 0) return value;
            return Math.Ceiling(value / gridSpacing) * gridSpacing;
        }

        // ── Structure type detector ───────────────────────────────────────────
        private static string DetectType(ModelContext ctx)
        {
            if (ctx.TotalMembers == 0)
                return "Empty Model";

            if (ctx.Braces > ctx.Columns)
                return "Braced Frame / Tower";

            if (ctx.Columns >= 4 && ctx.Beams >= 4)
            {
                double w = ctx.BoundingMaxX - ctx.BoundingMinX;
                double d = ctx.BoundingMaxY - ctx.BoundingMinY;
                double h = ctx.BoundingMaxZ - ctx.BoundingMinZ;

                if (h > w * 3)  return "Telecom Tower / Tall Structure";
                if (d > 100)    return "3D Frame / Multi-Bay Structure";
                return "Portal Frame / Multi-Column Structure";
            }

            if (ctx.Columns == 2 && ctx.Beams >= 1) return "Simple Frame / Pipe Support";
            if (ctx.Columns == 0)                   return "Horizontal Structure";
            return "Mixed Structure";
        }
    }
}
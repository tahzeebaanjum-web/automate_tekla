using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Tekla.Structures.Model;

using TeklaExtractor.AI;
using TeklaExtractor.Generator;
using TeklaExtractor.Models;

using Task = System.Threading.Tasks.Task;

class Program
{
    private static readonly HttpClient _http = new HttpClient
    {
        Timeout = TimeSpan.FromSeconds(10)
    };

    static async Task Main(string[] args)
    {
        Console.WriteLine("╔══════════════════════════════════════════════╗");
        Console.WriteLine("║   UNIVERSAL TEKLA AI BIM ASSISTANT v3.1     ║");
        Console.WriteLine("╚══════════════════════════════════════════════╝");

        // ── Connect to Tekla ──────────────────────────────────────────────
        Console.WriteLine("\n[1/3] Connecting to Tekla Structures...");
        var model = new Model();
        if (!model.GetConnectionStatus())
        {
            Console.WriteLine("❌ Tekla not connected. Open Tekla first.");
            return;
        }
        Console.WriteLine("✅ Connected to Tekla Structures");

        // ── Analyze existing model ────────────────────────────────────────
        Console.WriteLine("\n[2/3] Analyzing existing model...");
        var ctx = ModelAnalyzer.Analyze(model);

        // ── Extract + send to FastAPI ─────────────────────────────────────
        Console.WriteLine("\n[3/3] Extracting model data...");
        var members = ExtractModelMembers(model);
        string json = JsonConvert.SerializeObject(members, Formatting.Indented);

        string projectDir = Path.GetFullPath(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..")
        );
        File.WriteAllText(Path.Combine(projectDir, "output.json"), json);
        Console.WriteLine($"✅ Extracted {members.Count} members → output.json");

        await SendToFastAPI(json);

        // ── Start Universal Generator Loop ────────────────────────────────
        await RunUniversalLoop(model, ctx);
    }

    // ─────────────────────────────────────────────────────────────────────
    static Task RunUniversalLoop(Model model, ModelContext ctx)
    {
        var planner = new UniversalPlanner();
        var creator = new UniversalCreator(model);

        PrintHelp();

        bool running = true;

        // ── Background polling thread (UI se commands aate hain) ─────────
        var poll = new Thread(async () =>
        {
            while (running)
            {
                try
                {
                    string dashPrompt = await PollPendingPromptAsync();
                    if (!string.IsNullOrWhiteSpace(dashPrompt))
                    {
                        Console.WriteLine($"\n🌐 Dashboard command: \"{dashPrompt}\"");

                        // FIX: har command se pehle fresh ctx lo
                        ctx = ModelAnalyzer.Analyze(model);
                        Console.WriteLine($"[Loop] Fresh ctx → NextOrigin = " +
                                          $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");

                        ExecutePrompt(dashPrompt, planner, creator, model, ref ctx);
                        Console.Write("\n📝 Command: ");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Poll] Error: {ex.Message}");
                }
                Thread.Sleep(2000);
            }
        });
        poll.IsBackground = true;
        poll.Start();

        // ── Console input loop ────────────────────────────────────────────
        while (true)
        {
            Console.Write("\n📝 Command: ");
            string input = Console.ReadLine()?.Trim() ?? "";

            if (input.Equals("exit",    StringComparison.OrdinalIgnoreCase) ||
                input.Equals("quit",    StringComparison.OrdinalIgnoreCase))
            {
                running = false;
                Console.WriteLine("👋 Bye!");
                break;
            }

            if (input.Equals("help",    StringComparison.OrdinalIgnoreCase))
            { PrintHelp(); continue; }

            if (input.Equals("status",  StringComparison.OrdinalIgnoreCase))
            {
                ctx = ModelAnalyzer.Analyze(model);
                Console.WriteLine($"📊 {ctx}");
                Console.WriteLine($"   NextOrigin = " +
                                  $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");
                continue;
            }

            if (input.Equals("refresh", StringComparison.OrdinalIgnoreCase))
            {
                var mems = ExtractModelMembers(model);
                string js = JsonConvert.SerializeObject(mems, Formatting.Indented);
                string pd = Path.GetFullPath(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\"));
                File.WriteAllText(Path.Combine(pd, "output.json"), js);
                SendToFastAPI(js).Wait();
                ctx = ModelAnalyzer.Analyze(model);
                Console.WriteLine($"✅ Refreshed: {mems.Count} members");
                Console.WriteLine($"   NextOrigin = " +
                                  $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");
                continue;
            }

            if (string.IsNullOrWhiteSpace(input)) continue;

            // FIX: console command se pehle bhi fresh ctx lo
            ctx = ModelAnalyzer.Analyze(model);
            ExecutePrompt(input, planner, creator, model, ref ctx);
        }

        return Task.CompletedTask;
    }

    // ─────────────────────────────────────────────────────────────────────
    static void ExecutePrompt(
        string         input,
        UniversalPlanner planner,
        UniversalCreator creator,
        Model          model,
        ref ModelContext ctx)
    {
        try
        {
            Console.WriteLine($"\n[Execute] Prompt  : \"{input}\"");
            Console.WriteLine($"[Execute] Origin  : " +
                              $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");
            Console.WriteLine($"[Execute] Material: {ctx.DominantMaterial}  " +
                              $"Profile: {ctx.DominantProfile}");

            // ── Plan ─────────────────────────────────────────────────────
            var bimModel = planner.Plan(input, ctx);

            Console.WriteLine($"\n📋 Plan    : {bimModel.Name}");
            Console.WriteLine($"   Elements: {bimModel.TotalCount} " +
                              $"({bimModel.ColumnCount} cols, " +
                              $"{bimModel.BeamCount} beams, " +
                              $"{bimModel.BraceCount} braces)");

            // ── Create in Tekla ───────────────────────────────────────────
            bool ok = creator.Create(bimModel);

            if (ok)
            {
                Console.WriteLine($"\n✅ '{bimModel.Name}' created in Tekla!");
                Console.WriteLine("   Press Ctrl+F5 in Tekla to refresh view");

                // FIX: structure create hone ke BAAD ctx update karo
                // Taaki next command sahi origin se shuru kare
                ctx = ModelAnalyzer.Analyze(model);
                Console.WriteLine($"[Execute] Updated origin → " +
                                  $"({ctx.NextOriginX}, {ctx.NextOriginY}, {ctx.NextOriginZ})");

                // Auto-refresh dashboard
                var mems = ExtractModelMembers(model);
                string js = JsonConvert.SerializeObject(mems, Formatting.Indented);
                string pd = Path.GetFullPath(
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..\"));
                File.WriteAllText(Path.Combine(pd, "output.json"), js);
                SendToFastAPI(js).Wait();
                Console.WriteLine($"   Dashboard updated: {mems.Count} total members");
            }
            else
            {
                Console.WriteLine("\n❌ Creation failed — check Tekla catalog");
                Console.WriteLine("   Tip: run 'status' to see dominant profile/material");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error: {ex.Message}");
            Console.WriteLine($"   Stack: {ex.StackTrace}");
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    static void PrintHelp()
    {
        Console.WriteLine();
        Console.WriteLine("╔══════════════════════════════════════════════════╗");
        Console.WriteLine("║  UNIVERSAL BIM COMMANDS                         ║");
        Console.WriteLine("╠══════════════════════════════════════════════════╣");
        Console.WriteLine("║  STRUCTURES:                                    ║");
        Console.WriteLine("║  > create pipe support                          ║");
        Console.WriteLine("║  > x bracing height 4m                         ║");
        Console.WriteLine("║  > double level rack heavy                      ║");
        Console.WriteLine("║  > four column rack width 3000 depth 2000       ║");
        Console.WriteLine("║  > portal frame width 10m height 5m with haunch ║");
        Console.WriteLine("║  > telecom tower height 20m                     ║");
        Console.WriteLine("║  > equipment platform width 6m depth 4m         ║");
        Console.WriteLine("║  > multi bay pipe rack                          ║");
        Console.WriteLine("║  > staircase height 4m                          ║");
        Console.WriteLine("║  > roof truss width 8m height 2m                ║");
        Console.WriteLine("║  > canopy width 6m height 4m                    ║");
        Console.WriteLine("║  > water tank frame height 5m                   ║");
        Console.WriteLine("╠══════════════════════════════════════════════════╣");
        Console.WriteLine("║  SYSTEM:                                        ║");
        Console.WriteLine("║  > status   — model analysis + next origin      ║");
        Console.WriteLine("║  > refresh  — sync dashboard                    ║");
        Console.WriteLine("║  > help     — show this menu                    ║");
        Console.WriteLine("║  > exit     — quit                              ║");
        Console.WriteLine("╚══════════════════════════════════════════════════╝");
    }

    // ─────────────────────────────────────────────────────────────────────
    static async Task<string> PollPendingPromptAsync()
    {
        try
        {
            var r = await _http.GetAsync("http://127.0.0.1:8000/pending-prompt");
            if (!r.IsSuccessStatusCode) return null;
            string body = await r.Content.ReadAsStringAsync();
            dynamic d   = JsonConvert.DeserializeObject(body);
            string  p   = d?.prompt;
            return string.IsNullOrWhiteSpace(p) ? null : p;
        }
        catch { return null; }
    }

    // ─────────────────────────────────────────────────────────────────────
    static List<object> ExtractModelMembers(Model model)
    {
        var list = new List<object>();
        var all  = model.GetModelObjectSelector().GetAllObjects();

        while (all.MoveNext())
        {
            var beam = all.Current as Beam;
            if (beam == null) continue;
            try
            {
                var s   = beam.StartPoint;
                var e   = beam.EndPoint;
                double dx = e.X - s.X, dy = e.Y - s.Y, dz = e.Z - s.Z;
                double len = Math.Sqrt(dx * dx + dy * dy + dz * dz);
                bool isCol = Math.Abs(dz) > Math.Abs(dx) &&
                             Math.Abs(dz) > Math.Abs(dy);

                list.Add(new {
                    Id        = beam.Identifier.ID,
                    Guid      = beam.Identifier.GUID.ToString(),
                    Type      = isCol ? "COLUMN" : "BEAM",
                    Direction = isCol ? "VERTICAL" : "HORIZONTAL",
                    Name      = beam.Name,
                    Profile   = beam.Profile?.ProfileString   ?? "UNKNOWN",
                    Material  = beam.Material?.MaterialString ?? "UNKNOWN",
                    Class     = beam.Class  ?? "",
                    Finish    = beam.Finish ?? "",
                    StartPoint = new { X = s.X, Y = s.Y, Z = s.Z },
                    EndPoint   = new { X = e.X, Y = e.Y, Z = e.Z },
                    Geometry   = new {
                        DeltaX = dx, DeltaY = dy, DeltaZ = dz, Length = len
                    }
                });
            }
            catch { /* skip corrupt members */ }
        }
        return list;
    }

    // ─────────────────────────────────────────────────────────────────────
    static async Task SendToFastAPI(string json)
    {
        try
        {
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var resp    = await _http.PostAsync(
                              "http://127.0.0.1:8000/upload-model", content);
            string res  = await resp.Content.ReadAsStringAsync();
            Console.WriteLine($"[FastAPI] {res}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FastAPI] Error: {ex.Message}");
        }
    }
}
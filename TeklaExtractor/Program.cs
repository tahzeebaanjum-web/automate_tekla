using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Tekla.Structures.Model;

using Task = System.Threading.Tasks.Task;

class Program
{
    static async Task Main(string[] args)
    {
        Console.WriteLine("====================================");
        Console.WriteLine(" Connecting to Tekla Structures...");
        Console.WriteLine("====================================");

        Model model = new Model();

        if (!model.GetConnectionStatus())
        {
            Console.WriteLine("❌ Tekla Structures not connected.");
            return;
        }

        Console.WriteLine("✅ Connected successfully.");

        var members = new List<object>();

        ModelObjectEnumerator allObjects =
            model.GetModelObjectSelector().GetAllObjects();

        int count = 0;

        while (allObjects.MoveNext())
        {
            var obj = allObjects.Current;

            Beam beam = obj as Beam;

            if (beam == null)
                continue;

            try
            {
                var start = beam.StartPoint;
                var end   = beam.EndPoint;

                double dx = end.X - start.X;
                double dy = end.Y - start.Y;
                double dz = end.Z - start.Z;

                double length = Math.Sqrt(dx * dx + dy * dy + dz * dz);

                bool isColumn =
                    Math.Abs(dz) > Math.Abs(dx) &&
                    Math.Abs(dz) > Math.Abs(dy);

                string memberType = isColumn ? "COLUMN" : "BEAM";
                string direction  = isColumn ? "VERTICAL" : "HORIZONTAL";

                // ── GUID FIX ──────────────────────────────────────────────
                // Identifier.GUID is the stable cross-session identifier.
                // Identifier.ID is the in-session integer handle only.
                string guid = beam.Identifier.GUID.ToString();
                // ─────────────────────────────────────────────────────────

                members.Add(new
                {
                    Id        = beam.Identifier.ID,
                    Guid      = guid,                  // <── added
                    Type      = memberType,
                    Direction = direction,
                    Name      = beam.Name,
                    Profile   = beam.Profile?.ProfileString   ?? "UNKNOWN",
                    Material  = beam.Material?.MaterialString ?? "UNKNOWN",
                    Class     = beam.Class     ?? "",
                    Finish    = beam.Finish    ?? "",

                    StartPoint = new
                    {
                        X = start.X,
                        Y = start.Y,
                        Z = start.Z
                    },

                    EndPoint = new
                    {
                        X = end.X,
                        Y = end.Y,
                        Z = end.Z
                    },

                    Geometry = new
                    {
                        DeltaX = dx,
                        DeltaY = dy,
                        DeltaZ = dz,
                        Length = length
                    }
                });

                count++;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠ Error processing beam: {ex.Message}");
            }
        }

        string json = JsonConvert.SerializeObject(members, Formatting.Indented);

        // Save output.json in the project folder (TeklaExtractor), not bin/Debug
        string projectDir = Path.GetFullPath(
            Path.Combine(AppDomain.CurrentDomain.BaseDirectory, @"..\..\..")
        );
        string filePath = Path.Combine(projectDir, "output.json");

        File.WriteAllText(filePath, json);

        Console.WriteLine("====================================");
        Console.WriteLine($"📦 JSON saved at: {filePath}");
        Console.WriteLine($"📊 Total beams processed: {count}");
        Console.WriteLine("====================================");

        await SendToFastAPI(json);
    }

    static async Task SendToFastAPI(string json)
    {
        try
        {
            using (HttpClient client = new HttpClient())
            {
                client.Timeout = TimeSpan.FromMinutes(2);

                var content = new StringContent(
                    json,
                    Encoding.UTF8,
                    "application/json"
                );

                string url = "http://127.0.0.1:8000/upload-model";

                Console.WriteLine("====================================");
                Console.WriteLine("📡 Sending data to FastAPI...");
                Console.WriteLine($"➡ URL: {url}");
                Console.WriteLine("====================================");

                HttpResponseMessage response =
                    await client.PostAsync(url, content);

                string result =
                    await response.Content.ReadAsStringAsync();

                Console.WriteLine("====================================");
                Console.WriteLine($"Status Code : {(int)response.StatusCode}");
                Console.WriteLine($"Status      : {response.StatusCode}");
                Console.WriteLine("Response:");
                Console.WriteLine(result);
                Console.WriteLine("====================================");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("====================================");
            Console.WriteLine("❌ FastAPI connection error");
            Console.WriteLine("====================================");
            Console.WriteLine(ex.ToString());

            if (ex.InnerException != null)
            {
                Console.WriteLine("--------- INNER EXCEPTION ---------");
                Console.WriteLine(ex.InnerException.ToString());
            }

            Console.WriteLine("====================================");
        }
    }
}
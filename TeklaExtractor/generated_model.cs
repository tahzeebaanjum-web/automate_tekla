using System;
using System.Collections.Generic;
using Tekla.Structures.Model;
using Tekla.Structures.Geometry3d;

public class Element
{
    public string Type { get; set; }
    public string Profile { get; set; }
    public string Material { get; set; }

    public PointData StartPoint { get; set; }
    public PointData EndPoint { get; set; }
}

public class PointData
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
}

public class CreateStructure
{
    public static void Create(List<Element> elements)
    {
        Model model = new Model();

        if (!model.GetConnectionStatus())
        {
            Console.WriteLine("❌ Tekla not connected.");
            return;
        }

        Console.WriteLine("✅ Tekla connected. Creating model...");

        int created = 0;

        foreach (var e in elements)
        {
            try
            {
                string type = (e.Type ?? "").ToUpper();
                string profile = e.Profile ?? "HEA200";
                string material = e.Material ?? "S235JR";

                double x1 = e.StartPoint.X;
                double y1 = e.StartPoint.Y;
                double z1 = e.StartPoint.Z;

                double x2 = e.EndPoint.X;
                double y2 = e.EndPoint.Y;
                double z2 = e.EndPoint.Z;

                if (type == "BEAM" || type == "COLUMN")
                {
                    Beam beam = new Beam(
                        new Point(x1, y1, z1),
                        new Point(x2, y2, z2)
                    );

                    beam.Profile.ProfileString = profile;
                    beam.Material.MaterialString = material;
                    beam.Name = type;

                    if (beam.Insert())
                    {
                        created++;
                    }
                }
                else
                {
                    Console.WriteLine($"⚠ Unsupported type: {type}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ Error creating element: " + ex.Message);
            }
        }

        model.CommitChanges();

        Console.WriteLine("==================================");
        Console.WriteLine("✅ Structure Created Successfully");
        Console.WriteLine($"📦 Total Created: {created}");
        Console.WriteLine("==================================");
    }
}
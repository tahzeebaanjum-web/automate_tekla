using System;
using System.Collections.Generic;

namespace TeklaExtractor.Models
{
    /// <summary>
    /// Existing Tekla model ka full context — AI queries ke liye
    /// </summary>
    public class ModelContext
    {
        public int TotalMembers  { get; set; } = 0;
        public int Columns       { get; set; } = 0;
        public int Beams         { get; set; } = 0;
        public int Braces        { get; set; } = 0;
        public int Plates        { get; set; } = 0;

        public double BoundingMinX { get; set; } = 0;
        public double BoundingMinY { get; set; } = 0;
        public double BoundingMinZ { get; set; } = 0;
        public double BoundingMaxX { get; set; } = 0;
        public double BoundingMaxY { get; set; } = 0;
        public double BoundingMaxZ { get; set; } = 0;

        public string DetectedStructureType { get; set; } = "Unknown";
        public string DominantProfile       { get; set; } = "";
        public string DominantMaterial      { get; set; } = "";

        public List<string> AllProfiles  { get; set; } = new List<string>();
        public List<string> AllMaterials { get; set; } = new List<string>();

        // Next structure placement — existing structure ke baad
        public double NextOriginX { get; set; } = 0;
        public double NextOriginY { get; set; } = 0;
        public double NextOriginZ { get; set; } = 0;

        public bool IsEmpty => TotalMembers == 0;

        public override string ToString() =>
            $"Model: {TotalMembers} members " +
            $"[{Columns} cols, {Beams} beams, {Braces} braces] | " +
            $"Type: {DetectedStructureType} | " +
            $"Profile: {DominantProfile} | Material: {DominantMaterial}";
    }
}
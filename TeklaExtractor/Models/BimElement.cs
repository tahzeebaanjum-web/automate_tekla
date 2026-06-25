using System;
using System.Collections.Generic;

namespace TeklaExtractor.Models
{
    /// <summary>
    /// Universal BIM element — Tekla ka koi bhi structural member
    /// </summary>
    public class BimElement
    {
        public string Id          { get; set; } = Guid.NewGuid().ToString("N").Substring(0, 8);
        public string Type        { get; set; } = "BEAM";    // COLUMN, BEAM, BRACE, PLATE
        public string Profile     { get; set; } = "L50X50X5";
        public string Material    { get; set; } = "S235JR";
        public string Name        { get; set; } = "";
        public string Class       { get; set; } = "1";

        public double StartX { get; set; } = 0;
        public double StartY { get; set; } = 0;
        public double StartZ { get; set; } = 0;
        public double EndX   { get; set; } = 0;
        public double EndY   { get; set; } = 0;
        public double EndZ   { get; set; } = 1000;

        public string Description { get; set; } = "";

        public double Length =>
            Math.Sqrt(
                Math.Pow(EndX - StartX, 2) +
                Math.Pow(EndY - StartY, 2) +
                Math.Pow(EndZ - StartZ, 2));

        public bool IsColumn =>
            Math.Abs(EndZ - StartZ) > Math.Abs(EndX - StartX) &&
            Math.Abs(EndZ - StartZ) > Math.Abs(EndY - StartY);

        public override string ToString() =>
            $"{Type} [{Profile}/{Material}] " +
            $"({StartX},{StartY},{StartZ})→({EndX},{EndY},{EndZ}) L={Math.Round(Length)}mm";
    }

    /// <summary>
    /// UniversalCreator ko ye list pass karo — wo Tekla mein banayega
    /// </summary>
    public class BimModel
    {
        public string Name        { get; set; } = "AI Generated Structure";
        public string Description { get; set; } = "";
        public List<BimElement> Elements { get; set; } = new List<BimElement>();

        public int ColumnCount => Elements.FindAll(e => e.Type == "COLUMN").Count;
        public int BeamCount   => Elements.FindAll(e => e.Type == "BEAM").Count;
        public int BraceCount  => Elements.FindAll(e => e.Type == "BRACE").Count;
        public int TotalCount  => Elements.Count;
    }
}
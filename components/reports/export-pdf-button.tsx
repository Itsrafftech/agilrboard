"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportPdfButton({
  targetRef,
  fileName,
}: {
  targetRef: React.RefObject<HTMLElement>;
  fileName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    if (!targetRef.current) return;
    setLoading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${fileName}.pdf`);
      toast.success("Report exported");
    } catch {
      toast.error("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleExport} loading={loading}>
      <Download className="h-4 w-4" />
      Export PDF
    </Button>
  );
}

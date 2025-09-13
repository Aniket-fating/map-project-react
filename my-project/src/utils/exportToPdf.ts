import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
// import html2canvas from "html2canvas";

interface ExportProps {
    key: string;
    data: any[];
}

export const handleExportToPDF = async ({ key, data }: ExportProps) => {
    if (!data || !data.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const formattedDate = format(new Date(), "dd-MM-yyyy");

    let headerText = "";
    let tableColumn: string[] = [];
    let tableRows: any[] = [];
    let totals: any = {};

   
    if (key === "Maharashtra Divisions Summary") {
        headerText = "Maharashtra Divisions Stats";

        tableColumn = [
            "Sr No.",
            "Divisions",
            "ULB Count",
            "Total Houses",
            "Scanned Houses",
            "Active Employees",
            "Dump Trips",
        ];

        tableRows = data.map((item, index) => [
            index + 1,
            item.name || item.divisionName || "N/A",
            item.ulbCount,
            item.totalHouse,
            item.totalHouseScan,
            item.totalActiveEmp,
            item.totalDumpTrip,
        ]);

        totals = {
            ulbCount: data.reduce((s, d) => s + (d.ulbCount || 0), 0),
            totalHouse: data.reduce((s, d) => s + (d.totalHouse || 0), 0),
            totalHouseScan: data.reduce((s, d) => s + (d.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((s, d) => s + (d.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((s, d) => s + (d.totalDumpTrip || 0), 0),
        };

        tableRows.push([
            "",
            "TOTAL",
            totals.ulbCount,
            totals.totalHouse,
            totals.totalHouseScan,
            totals.totalActiveEmp,
            totals.totalDumpTrip,
        ]);
    } else if (
        key === "Maharashtra Districts Summary" ||
        key === "Maharashtra Default Summary"
    ) {
        headerText = "Districts Stats";

        tableColumn = [
            "Sr No.",
            "Districts",
            "ULB Count",
            "Total Houses",
            "Scanned Houses",
            "Active Employees",
            "Dump Trips",
        ];

        tableRows = data.map((item, index) => [
            index + 1,
            item.ulbName || "N/A",
            item.ulbCount,
            item.totalHouse,
            item.totalHouseScan,
            item.totalActiveEmp,
            item.totalDumpTrip,
        ]);

        totals = {
            ulbCount: data.reduce((s, d) => s + (d.ulbCount || 0), 0),
            totalHouse: data.reduce((s, d) => s + (d.totalHouse || 0), 0),
            totalHouseScan: data.reduce((s, d) => s + (d.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((s, d) => s + (d.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((s, d) => s + (d.totalDumpTrip || 0), 0),
        };

        tableRows.push([
            "",
            "TOTAL",
            totals.ulbCount,
            totals.totalHouse,
            totals.totalHouseScan,
            totals.totalActiveEmp,
            totals.totalDumpTrip,
        ]);
    } else if (key === "Maharashtra Ulb Summary") {
        headerText = "Ulb Stats";

        tableColumn = [
            "Sr No.",
            "Ulbs",
            "Total Houses",
            "Scanned Houses",
            "Active Employees",
            "Dump Trips",
        ];

        tableRows = data.map((item, index) => [
            index + 1,
            item.ulbName || "N/A",
            item.totalHouse,
            item.totalHouseScan,
            item.totalActiveEmp,
            item.totalDumpTrip,
        ]);

        totals = {
            totalHouse: data.reduce((s, d) => s + (d.totalHouse || 0), 0),
            totalHouseScan: data.reduce((s, d) => s + (d.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((s, d) => s + (d.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((s, d) => s + (d.totalDumpTrip || 0), 0),
        };

        tableRows.push([
            "",
            "TOTAL",
            totals.totalHouse,
            totals.totalHouseScan,
            totals.totalActiveEmp,
            totals.totalDumpTrip,
        ]);
    }

    // ====== Header Title ======
    doc.setFontSize(13);
    doc.setTextColor("black");
    doc.setFont("times", "bold");
    doc.text(headerText, 14, 10);

    // ====== Date on Right ======
    const dateText = `Date : ${formattedDate}`;
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    const textWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - textWidth - 14, 10);

    // ====== Table ======
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        styles: {
            halign: "center",
            valign: "middle",
            fontSize: 10,
            textColor: 20,
        },
        headStyles: {
            fillColor: [51, 51, 51],
            textColor: [255, 255, 255],
            fontStyle: "bold",
        },
        footStyles: {
            fillColor: [239, 239, 239],
            textColor: [0, 0, 0],
            fontStyle: "bold",
        },
        didParseCell: (data) => {
            // Detect TOTAL row
            if (
                data.row.raw &&
                (data.row.raw[1] === "TOTAL" || data.row.raw[0] === "TOTAL")
            ) {
                data.cell.styles.fillColor = [0, 0, 0];      // black background
                data.cell.styles.textColor = [255, 255, 255]; // white text
                data.cell.styles.fontStyle = "bold";          // bold font
            }
        },
    });

    // const finalY = (doc as any).lastAutoTable.finalY || 30;

    // if (key === "Maharashtra Divisions Summary" || key === "Maharashtra Districts Summary" ) {

    //     const mapNode =
    //         document.getElementById("division-map-container")

    //     if (mapNode) {
    //         try {
    //             const canvas = await html2canvas(mapNode, { scale: 2 });
    //             const imgData = canvas.toDataURL("image/png");

                
    //             doc.setFontSize(12);
    //             doc.setFont("times", "bold");
    //             doc.text(`${headerText.replace("Stats", "")} Map`, 14, finalY + 15);

    //             const pageHeight = doc.internal.pageSize.getHeight();
    //             const margin = 10; // Replace with the desired margin value
    //             const maxImgWidth = pageWidth - margin * 2;   // leave margin on both sides
    //             const maxImgHeight = pageHeight - (finalY + 60); // space for caption & footer

                
    //             let imgWidth = maxImgWidth;
    //             let imgHeight = (canvas.height * imgWidth) / canvas.width;

    //             if (imgHeight > maxImgHeight) {
    //                 imgHeight = maxImgHeight;
    //                 imgWidth = (canvas.width * imgHeight) / canvas.height;
    //             }

         
    //             const x = (pageWidth - imgWidth) / 2;

    //             doc.addImage(imgData, "PNG", x, finalY + 20, imgWidth, imgHeight);




    //         } catch (err) {
    //             console.error("Error capturing map:", err);
    //         }
    //     } else {
    //         console.warn(" No visible map container found.");
    //     }
    // }

    // Save file
    const fileName = `${headerText}_${formattedDate}.pdf`;
    doc.save(fileName);
};

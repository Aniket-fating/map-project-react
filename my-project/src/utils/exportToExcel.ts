import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import html2canvas from "html2canvas";

interface ExportProps {
    key: string;
    data: any[];
}

export const handleExportToExcel = async ({ key, data }: ExportProps) => {
    if (!data || !data.length) return;
// const captureMap = async () => {
//   const mapElement = document.querySelector(".leaflet-container"); // adjust selector if needed
//   if (!mapElement) return null;

//   const canvas = await html2canvas(mapElement as HTMLElement, {
//     useCORS: true,
//     logging: false,
//     scale: 2, // better quality
//   });

//   return canvas.toDataURL("image/png");
// };


    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Map Stats");

    const formattedDate = format(new Date(), "dd-MM-yyyy");
    let headerText = "";




    if (key === "Maharashtra Divisions Summary") {
        worksheet.columns = [
            { header: "Sr No.", key: "srNo", width: 10 },
            { header: "Divisions", key: "name", width: 30 },
            { header: "ULB Count", key: "ulbCount", width: 15 },
            { header: "Total Houses", key: "totalHouse", width: 15 },
            { header: "Total House Scan", key: "totalHouseScan", width: 18 },
            { header: "Active Employees", key: "totalActiveEmp", width: 18 },
            { header: "Dump Trips", key: "totalDumpTrip", width: 15 },
        ];

        headerText = "Division Stats";

        // Add top row
        worksheet.insertRow(1, []);
        worksheet.getCell("A1").value = headerText;
        worksheet.getCell("A1").font = { bold: true, size: 12 };
        worksheet.getCell("A1").alignment = { horizontal: "left" };

        worksheet.getCell("C1").value = `Date : ${formattedDate}`;
        worksheet.getCell("C1").font = { italic: true, size: 10 };
        worksheet.getCell("C1").alignment = { horizontal: "right" };

       const headerRow = worksheet.getRow(2);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; // white text
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF333333" }, // dark background
            };
        });
        // Data rows
        data.forEach((item: any, index: number) => {
            worksheet.addRow({
                srNo: index + 1,
                name: item.name || item.divisionName || item.districtName || "N/A",
                ulbCount: item.ulbCount,
                totalHouse: item.totalHouse,
                totalHouseScan: item.totalHouseScan,
                totalActiveEmp: item.totalActiveEmp,
                totalDumpTrip: item.totalDumpTrip,
            });
        });

        // ✅ Add totals row at the end
        const totals = {
            ulbCount: data.reduce((sum, div) => sum + (div.ulbCount || 0), 0),
            totalHouse: data.reduce((sum, div) => sum + (div.totalHouse || 0), 0),
            totalHouseScan: data.reduce((sum, div) => sum + (div.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((sum, div) => sum + (div.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((sum, div) => sum + (div.totalDumpTrip || 0), 0),
        };

        const totalsRow = worksheet.addRow({
            srNo: "",
            name: "TOTAL",
            ulbCount: totals.ulbCount,
            totalHouse: totals.totalHouse,
            totalHouseScan: totals.totalHouseScan,
            totalActiveEmp: totals.totalActiveEmp,
            totalDumpTrip: totals.totalDumpTrip,
        });

        // Style totals row
        totalsRow.eachCell((cell: any) => {
            cell.font = { bold: true };
            cell.alignment = { vertical: "left", horizontal: "right" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEFEFEF" },
            };
        });


        // const mapImage = await captureMap();
// if (mapImage) {
//     const imageId = workbook.addImage({
//         base64: mapImage,
//         extension: "png",
//     });

//     // Get last row number after totals
//     const lastRowNumber = worksheet.lastRow?.number || data.length + 5;

//     // Place image below table (with 2 row gap)
//     worksheet.addImage(imageId, {
//         tl: { col: 0, row: lastRowNumber + 2 },
//         ext: { width: 500, height: 450 },
//     });
// }
    } else if (key === "Maharashtra Districts Summary" || key === "Maharashtra Default Summary") {

        worksheet.columns = [
            { header: "Sr No.", key: "srNo", width: 10 },
            { header: "Districts", key: "ulbName", width: 30 },
            { header: "ULB Count", key: "ulbCount", width: 15 },
            { header: "Total Houses", key: "totalHouse", width: 15 },
            { header: "Total House Scan", key: "totalHouseScan", width: 18 },
            { header: "Active Employees", key: "totalActiveEmp", width: 18 },
            { header: "Dump Trips", key: "totalDumpTrip", width: 15 },
        ];

        headerText = "District Stats";

        // Add top row
        worksheet.insertRow(1, []);
        worksheet.getCell("A1").value = headerText;
        worksheet.getCell("A1").font = { bold: true, size: 12 };
        worksheet.getCell("A1").alignment = { horizontal: "left" };

        worksheet.getCell("C1").value = `Date : ${formattedDate}`;
        worksheet.getCell("C1").font = { italic: true, size: 10 };
        worksheet.getCell("C1").alignment = { horizontal: "right" };

          const headerRow = worksheet.getRow(2);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; // white text
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF333333" }, // dark background
            };
        });
        // Data rows
        data.forEach((item: any, index: number) => {

            worksheet.addRow({
                srNo: index + 1,
                ulbName: item.ulbName || "N/A",
                ulbCount: item.ulbCount,
                totalHouse: item.totalHouse,
                totalHouseScan: item.totalHouseScan,
                totalActiveEmp: item.totalActiveEmp,
                totalDumpTrip: item.totalDumpTrip,
            });
        });

        // ✅ Add totals row at the end
        const totals = {
            ulbCount: data.reduce((sum, div) => sum + (div.ulbCount || 0), 0),
            totalHouse: data.reduce((sum, div) => sum + (div.totalHouse || 0), 0),
            totalHouseScan: data.reduce((sum, div) => sum + (div.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((sum, div) => sum + (div.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((sum, div) => sum + (div.totalDumpTrip || 0), 0),
        };

        const totalsRow = worksheet.addRow({
            srNo: "",
            ulbName: "TOTAL",
            ulbCount: totals.ulbCount,
            totalHouse: totals.totalHouse,
            totalHouseScan: totals.totalHouseScan,
            totalActiveEmp: totals.totalActiveEmp,
            totalDumpTrip: totals.totalDumpTrip,
        });

        // Style totals row
        totalsRow.eachCell((cell: any) => {
            cell.font = { bold: true };
            cell.alignment = { vertical: "left", horizontal: "right" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEFEFEF" },
            };
        });

        // const mapImage = await captureMap();
// if (mapImage) {
//     const imageId = workbook.addImage({
//         base64: mapImage,
//         extension: "png",
//     });

//     // Get last row number after totals
//     const lastRowNumber = worksheet.lastRow?.number || data.length + 5;

//     // Place image below table (with 2 row gap)
//     worksheet.addImage(imageId, {
//         tl: { col: 0, row: lastRowNumber + 2 },
//         ext: { width: 500, height: 450 },
//     });
// }
    } else if (key === "Maharashtra Ulb Summary") {

        worksheet.columns = [
            { header: "Sr No.", key: "srNo", width: 10 },
            { header: "Ulbs", key: "ulbName", width: 30 },
            { header: "Total Houses", key: "totalHouse", width: 15 },
            { header: "Total House Scan", key: "totalHouseScan", width: 18 },
            { header: "Active Employees", key: "totalActiveEmp", width: 18 },
            { header: "Dump Trips", key: "totalDumpTrip", width: 15 },
        ];

        headerText = "Ulb Stats";

        // Add top row
        worksheet.insertRow(1, []);
        worksheet.getCell("A1").value = headerText;
        worksheet.getCell("A1").font = { bold: true, size: 12 };
        worksheet.getCell("A1").alignment = { horizontal: "left" };

        worksheet.getCell("C1").value = `Date : ${formattedDate}`;
        worksheet.getCell("C1").font = { italic: true, size: 10 };
        worksheet.getCell("C1").alignment = { horizontal: "right" };


        // ✅ Style header row (row 2)
        const headerRow = worksheet.getRow(2);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; // white text
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF333333" }, // dark background
            };
        });

        // Data rows
        data.forEach((item: any, index: number) => {
            worksheet.addRow({
                srNo: index + 1,
                ulbName: item.ulbName || "N/A",
                totalHouse: item.totalHouse,
                totalHouseScan: item.totalHouseScan,
                totalActiveEmp: item.totalActiveEmp,
                totalDumpTrip: item.totalDumpTrip,
            });
        });

        // ✅ Add totals row at the end
        const totals = {
            totalHouse: data.reduce((sum, div) => sum + (div.totalHouse || 0), 0),
            totalHouseScan: data.reduce((sum, div) => sum + (div.totalHouseScan || 0), 0),
            totalActiveEmp: data.reduce((sum, div) => sum + (div.totalActiveEmp || 0), 0),
            totalDumpTrip: data.reduce((sum, div) => sum + (div.totalDumpTrip || 0), 0),
        };

        const totalsRow = worksheet.addRow({
            srNo: "",
            ulbName: "TOTAL",
            totalHouse: totals.totalHouse,
            totalHouseScan: totals.totalHouseScan,
            totalActiveEmp: totals.totalActiveEmp,
            totalDumpTrip: totals.totalDumpTrip,
        });

        // Style totals row
        totalsRow.eachCell((cell: any) => {
            cell.font = { bold: true };
            cell.alignment = { vertical: "left", horizontal: "right" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEFEFEF" },
            };
        });

        
    }
    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileName = `${headerText}_${formattedDate}.xlsx`;
    saveAs(blob, fileName);
};

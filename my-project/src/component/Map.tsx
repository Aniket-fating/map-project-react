import { useEffect, useState } from "react";
import { MapContainer, GeoJSON, useMap, Marker } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// import { motion } from "framer-motion";
import divisions from "../data/maharashtraDivisions.json";
import districts from "../data/divisions/districtsData.json";
import axios from "axios";
import excel from "../assets/excel.png"
import pdf from "../assets/pdf.png"
import Loader from "../loader";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

//---------- Types ----------
type AnyFeature = Feature<Geometry, { [k: string]: any }>;

// ---------- Helpers ----------
function FitBounds({ data }: { data: FeatureCollection }) {
    const map = useMap();
    useEffect(() => {
        if (!data) return;
        const gj = new L.GeoJSON(data as any);
        const b = gj.getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [20, 20], maxZoom: 8 });
    }, [data, map]);
    return null;
}

function getPolygonCentroid(feature: AnyFeature) {
    if (feature.geometry.type === "Polygon") {
        return centroidOfCoords(feature.geometry.coordinates[0]);
    }
    if (feature.geometry.type === "MultiPolygon") {
        const centroids = feature.geometry.coordinates.map((poly) =>
            centroidOfCoords(poly[0])
        );
        const avgLat = centroids.reduce((s, c) => s + c.lat, 0) / centroids.length;
        const avgLng = centroids.reduce((s, c) => s + c.lng, 0) / centroids.length;
        return L.latLng(avgLat, avgLng);
    }
    return L.latLng(0, 0);
}

function centroidOfCoords(coords: number[][]) {
    let x = 0, y = 0, area = 0;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
        const [xi, yi] = coords[i];
        const [xj, yj] = coords[j];
        const f = xi * yj - xj * yi;
        area += f;
        x += (xi + xj) * f;
        y += (yi + yj) * f;
    }
    area *= 0.5;
    x /= 6 * area;
    y /= 6 * area;
    return L.latLng(y, x);
}

// ---------- Safe Name Helpers ----------
const getDivisionName = (props: any) => {
    const rawName =
        props?.Division_Name ||
        props?.division ||
        props?.DIVISION ||
        props?.DivName ||
        `Division ${props?.Division_Id || "?"}`;

    const name = rawName.toLowerCase();

    const divisions: Record<string, string> = {
        nagpur: "Nagpur",
        pune: "Pune",
        nashik: "Nashik",
        aurangabad: "Aurangabad",
        amravati: "Amravati",
        mumbai: "Mumbai",
    };

    for (const key in divisions) {
        if (name.includes(key)) {
            return divisions[key];
        }
    }
    return rawName;
};

const getDistrictName = (props: any) =>
    props?.Dist_Name ||
    props?.district ||
    props?.DISTRICT ||
    props?.District ||
    `District ${props?.District_Id || "?"}`;

// ---------- Styles ----------
const divisionColors: Record<number, string> = {
    1: "#ff9800", // Amravati
    2: "#4285f4", // Aurangabad
    3: "#34a853", // Konkan
    4: "#f28b82", // Nagpur
    5: "#fbbc04", // Nashik
    6: "#9c27b0", // Pune
};

const divisionStyle = (feature?: AnyFeature): PathOptions => ({
    color: "black",
    weight: 2,
    fillColor: divisionColors[feature?.properties?.Division_Id] || "#cfd8dc",
    fillOpacity: 0.5,
});

function getColorForDistrict(districtId: number | string) {
    const colors = [
        "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
        "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
        "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
        "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080"
    ];
    if (districtId == null) return "#cccccc";
    const index = Math.abs(
        String(districtId).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    ) % colors.length;
    return colors[index];
}

const districtStyle = (feature?: AnyFeature): PathOptions => {
    const distId = feature?.properties?.District_Id;
    return {
        color: "#333",
        weight: 1,
        fillColor: getColorForDistrict(distId),
        fillOpacity: 0.6,
    };
};

const ulbStyle: PathOptions = {
    color: "#0066cc",
    weight: 1,
    fillColor: "#66b3ff",
    fillOpacity: 0.4,
};

interface ExportProps {
    key: string;
    data: any[];
}




export default function Map() {
    const [mapData, setMapData] = useState<FeatureCollection>(
        divisions as FeatureCollection
    );
    const [isDivisionLevel, setIsDivisionLevel] = useState(true);
    const [layerKey, setLayerKey] = useState("divisions");
    const [currentDivisionId, setCurrentDivisionId] = useState<number | null>(null);
    const [currentDistrict, setCurrentDistrict] = useState<string | null>(null);
    const [labels, setLabels] = useState<{ name: string; lat: number; lng: number }[]>([]);
    const [ulbs, setUlbs] = useState<any>(null);
    const [selectedDetails, setSelectedDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
    const [tableUlbData, setTableUlbData] = useState<any[]>([]);
    // ✨ NEW: State to hold combined data for the summary table
    const [allDivisionsStats, setAllDivisionsStats] = useState<any>(null);
    const [parentName, setParentName] = useState<string>("");


    async function fetchData(divisionId: string = "0", districtId: string = "0") {
        const obj = {
            divisionId,
            districtId,
            appId: "0",
            userId: "0",
            date: new Date().toISOString(),
        };

        try {
            const { data } = await axios.post(
                "https://dmaapi.ictsbm.com/api/DmaDashboard/GetDmaDetails",
                obj,
                { headers: { dmaloginid: "testdma" } }
            );

            setParentName(data.data[0]?.parentULB || "")
            setUlbs(data.data || []);
            return data.data;
        } catch (err) {
            console.error("Error fetching data:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    }
    //ulbTabledata
    async function fetchData2(divisionId: string = "0", districtId: string = "0") {
        const obj = {
            divisionId,
            districtId,
            appId: "0",
            userId: "0",
            date: new Date().toISOString(),
        };

        try {
            const { data } = await axios.post(
                "https://dmaapi.ictsbm.com/api/DmaDashboard/GetDmaDetails",
                obj,
                { headers: { dmaloginid: "testdma" } }
            );

            setTableUlbData(data.data || []);
            return data.data;
        } catch (err) {
            console.error("Error fetching data:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        fetchData("0", "0");
    }, []);
    //exportToExcel

    const handleExportToExcel = async ({ key, data }: ExportProps) => {

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
        let headerText = ``;




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

            headerText = "Maharashtra Division Stats";

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

            headerText = ` ${parentName} District Stats`;

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

            headerText = `${currentDistrict} Ulb Stats`;

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


    const handleExportToPDF = async ({ key, data }: ExportProps) => {
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
            headerText = `${parentName} Districts Stats`;

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
            headerText = `${currentDistrict} Ulb Stats`;

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
    const divisionIdMap: Record<number, string> = {
        1: "Amravati",
        2: "Aurangabad",
        3: "Konkan (Mumbai)",
        4: "Nagpur",
        5: "Nashik",
        6: "Pune",
    };

    const onEachDivision = (feature: any, layer: any) => {
        const divisionId = feature.properties?.Division_Id;
        const divisionName: string = getDivisionName(feature.properties);

        let statsForDivision = {
            ulbCount: 0,
            totalHouse: 0,
            totalHouseScan: 0,
            totalActiveEmp: 0,
            totalDumpTrip: 0,
        };

        ulbs.forEach((item: any) => {

            if (String(item.ulbId) === String(divisionId)) {
                statsForDivision = {
                    ulbCount: item.ulbCount || 0,
                    totalHouse: item.totalHouse || 0,
                    totalHouseScan: item.totalHouseScan || 0,
                    totalActiveEmp: item.totalActiveEmp || 0,
                    totalDumpTrip: item.totalDumpTrip || 0,
                };
            }
        });

        const content = `<strong>${divisionName}</strong><br/>
      🏢 ULB Count: ${statsForDivision.ulbCount}<br/>
      🏠 Total Houses: ${statsForDivision.totalHouse}<br/>
      📊 Scanned Houses: ${statsForDivision.totalHouseScan}<br/>
      👷 Active Employees: ${statsForDivision.totalActiveEmp}<br/>
      🚛 Dump Trips: ${statsForDivision.totalDumpTrip}
    `;

        layer.on("mouseover", (e: any) => {
            const { clientX, clientY } = e.originalEvent;
            setTooltip({ x: clientX, y: clientY, content });
            (layer as L.Path).setStyle({ weight: 3, fillOpacity: 0.7 });
            (layer as L.Path).bringToFront();
        });

        layer.on("mousemove", (e: any) => {
            setTooltip((prev) =>
                prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null
            );
        });

        layer.on("mouseout", () => {
            setTooltip(null);
            (layer as L.Path).setStyle(divisionStyle(feature));
        });

        layer.on("click", async (e: any) => {
            if (e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            }

            const filteredDistricts: FeatureCollection = {
                type: "FeatureCollection",
                features: (districts as FeatureCollection).features.filter(
                    (f) => f.properties?.Division_Id === feature.properties?.Division_Id
                ),
            };

            await fetchData(String(feature.properties?.Division_Id), "0");
            setMapData(filteredDistricts);
            setIsDivisionLevel(false);
            setCurrentDivisionId(feature.properties?.Division_Id);
            // setCurrentDistrict(null);
            setLayerKey(`division-${feature.properties?.Division_Id}`);

            setSelectedDetails({
                type: "division",
                id: feature.properties?.Division_Id,
                name: divisionName,
                stats: statsForDivision,
            });
        });
    };

    const onEachDistrict = (feature: AnyFeature, layer: Layer) => {
        const distId = feature.properties?.District_Id;
        const distName = getDistrictName(feature.properties);
        const statsForDistrict = {
            ulbCount: 0,
            totalHouse: 0,
            totalHouseScan: 0,
            totalActiveEmp: 0,
            totalDumpTrip: 0,
        };


        ulbs.forEach((item: any) => {

            if (String(item.ulbId) === String(distId)) {
                statsForDistrict.ulbCount = item.ulbCount || 0
                statsForDistrict.totalHouse = item.totalHouse || 0
                statsForDistrict.totalHouseScan = item.totalHouseScan || 0
                statsForDistrict.totalActiveEmp = item.totalActiveEmp || 0
                statsForDistrict.totalDumpTrip = item.totalDumpTrip || 0
            }
        });

        const content = `<strong>${distName}</strong><br/>
      🏢 ULB Count: ${statsForDistrict.ulbCount}<br/>
      🏠 Total Houses: ${statsForDistrict.totalHouse}<br/>
      📊 Scanned Houses: ${statsForDistrict.totalHouseScan}<br/>
      👷 Active Employees: ${statsForDistrict.totalActiveEmp}<br/>
      🚛 Dump Trips: ${statsForDistrict.totalDumpTrip}
    `;

        layer.on("mouseover", (e: any) => {

            const { clientX, clientY } = e.originalEvent;
            setTooltip({ x: clientX, y: clientY, content });
            (layer as L.Path).setStyle({ weight: 3, fillOpacity: 0.7 });
            (layer as L.Path).bringToFront();
        });

        layer.on("mousemove", (e: any) => {

            setTooltip((prev) =>
                prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null
            );
        });

        layer.on("mouseout", () => {
            setTooltip(null);
            (layer as L.Path).setStyle(districtStyle(feature));
        });

        layer.on("click", async (e: any) => {
            if (e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            }

            await fetchData2(String(feature.properties.Division_Id), String(distId));
            setMapData({ type: "FeatureCollection", features: [feature] });
            setCurrentDistrict(distName);
            setLayerKey(`district-${distId}`);

            setSelectedDetails(null)
        });
    };

    const handleBack = async () => {
        if (currentDistrict) {
            const parentDivisionId = mapData.features[0].properties?.Division_Id;
            const filteredDistricts: FeatureCollection = {
                type: "FeatureCollection",
                features: (districts as FeatureCollection).features.filter(
                    (f) => f.properties?.Division_Id === parentDivisionId
                ),
            };
            setMapData(filteredDistricts);
            setCurrentDistrict(null);
            setUlbs(null);
            setSelectedDetails(null);
            setLoading(true);
            setLayerKey(`division-${parentDivisionId}`);
            setIsDivisionLevel(false);
            setTableUlbData(null)
            await fetchData(String(parentDivisionId), "0");
        } else if (!isDivisionLevel) {
            setMapData(divisions as FeatureCollection);
            setIsDivisionLevel(true);
            setCurrentDivisionId(null);
            setUlbs(null);
            setSelectedDetails(null);
            setLoading(true);
            setLayerKey("divisions");
            await fetchData("0", "0");
        }
    };

    useEffect(() => {
        if (!mapData) return;
        const centers = (mapData.features as AnyFeature[]).map((feature) => {
            const name = isDivisionLevel
                ? getDivisionName(feature.properties)
                : getDistrictName(feature.properties);
            const center = getPolygonCentroid(feature);
            return { name, lat: center.lat, lng: center.lng };
        });
        setLabels(centers);
    }, [mapData, isDivisionLevel, ulbs]);


    useEffect(() => {
        if (isDivisionLevel && ulbs && ulbs.length > 0) {
            const combinedStats = divisions.features.map(feature => {
                const divisionId = feature.properties.Division_Id;
                const divisionName = getDivisionName(feature.properties);
                const apiData = ulbs.find(item => String(item.ulbId) === String(divisionId)) || {};

                return {
                    id: divisionId,
                    name: divisionName,
                    ulbCount: apiData.ulbCount || 0,
                    totalHouse: apiData.totalHouse || 0,
                    totalHouseScan: apiData.totalHouseScan || 0,
                    totalActiveEmp: apiData.totalActiveEmp || 0,
                    totalDumpTrip: apiData.totalDumpTrip || 0,
                };
            });
            setAllDivisionsStats(combinedStats);

        }
    }, [ulbs, isDivisionLevel]);





    const getHeading = () => {
        if (isDivisionLevel) return "Maharashtra Divisions";
        if (currentDistrict) return `${currentDistrict} District ULBs`;
        if (currentDivisionId) {
            const name = divisionIdMap[currentDivisionId] || `Division ${currentDivisionId}`;
            //   console.log(name)
            return `${name} Districts`;
        }
        return "";

    };


    if (loading) {
        return <Loader />;
    }

    return (

        <div className=" h-screen w-full relative">
            {/* Header */}
            <header className="p-4 bg-blue-600 text-white text-xl font-bold sticky top-0 z-20 ">
                Maharashtra Map — Divisions, Districts & ULBs
            </header>

            <div className="h-[calc(100vh-105px)] w-full flex flex-col">
                {/* Dynamic heading */}
                <h2 className="text-center my-2 text-lg font-semibold">
                    {getHeading()}
                </h2>

                {/* Back Button */}
                <div className="absolute top-16 left-8 ">
                    {(currentDivisionId || currentDistrict) && (
                        <button
                            onClick={handleBack}
                            className="bg-white px-3 py-1 rounded shadow text-sm font-medium hover:bg-gray-200"
                        >
                            ⬅ Back
                        </button>
                    )}
                </div>

                {/* Main Section */}
                <main className="flex-1 h-full w-full p-2 sm:p-4 bg-gray-50">
                    <div className="h-full w-full rounded-lg shadow flex flex-col lg:flex-row">
                        {/* ================= Left Side: Map ================= */}
                        {ulbs ? (
                            <div className="w-full min-h-[300px] sm:min-h-[400px] lg:w-1/2 lg:h-full  z-10">
                                <div id="division-map-container" className="h-full w-full ">
                                    <MapContainer
                                        center={[19.7515, 75.7139]}
                                        maxZoom={10}
                                        style={{ height: "100%", width: "100%" }}
                                        dragging={false}
                                    >
                                        <GeoJSON
                                            key={layerKey}
                                            data={mapData}
                                            style={isDivisionLevel ? divisionStyle : districtStyle}
                                            onEachFeature={isDivisionLevel ? onEachDivision : onEachDistrict}
                                        />
                                        {ulbs && <GeoJSON data={ulbs} style={ulbStyle} />}

                                        {labels.map((lbl, i) => (
                                            <Marker
                                                key={i}
                                                position={[lbl.lat, lbl.lng]}
                                                icon={L.divIcon({
                                                    className: "map-label",
                                                    html: `<div style="
                                                            pointer-events: none;
                                                            display: flex;
                                                            align-items:center;
                                                            justify-content: center;
                                                            font-size: 10px;
                                                            font-weight: bold;
                                                            color: black;
                                                            text-shadow: 1px 1px 2px white;
                                                            padding: 2px 6px;
                                                            text-align: center;
                                                            min-width: 60px;
                                                        ">${lbl.name}</div>`,
                                                    iconAnchor: [30, 15],
                                                })}
                                            />
                                        ))}

                                        <FitBounds data={mapData} />
                                    </MapContainer>
                                </div>
                            </div>
                        ) : null}

                        {/* ================= Right Side: Table ================= */}
                        <div className="w-full lg:w-1/2 h-auto bg-gray-50 p-3 sm:p-4 lg:p-6 border-t lg:border-t-0 lg:border-l">
                            {/* Header + Date */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800 border-b pb-2">
                                    Division / District / ULB Details
                                </h3>
                                <div className="text-black text-xs sm:text-sm md:text-md font-semibold mb-2 sm:mb-0">
                                    {(() => {
                                        const today = new Date();
                                        const dd = String(today.getDate()).padStart(2, "0");
                                        const mm = String(today.getMonth() + 1).padStart(2, "0");
                                        const yyyy = today.getFullYear();
                                        return (
                                            <span className="font-bold">
                                                Date: {dd}-{mm}-{yyyy}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* ================= Table Wrapper ================= */}
                            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] border rounded-lg mt-3 sm:mt-4">
                                {selectedDetails ? (
                                    <>
                                        <h2 className="text-base sm:text-lg font-semibold mb-3 text-gray-800 px-2">
                                            {parentName} Divisions Details
                                        </h2>

                                        {/* Export buttons */}
                                        <div className="relative  flex justify-end space-x-3 px-2 mb-2">
                                            {/* Excel */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToExcel({
                                                            key: "Maharashtra Districts Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                    className="hover:cursor-pointer"
                                                >
                                                    <img height={22} width={22} src={excel} alt="Excel" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-24 p-1 rounded-md ">
                                                    Download Excel
                                                </div>
                                            </div>

                                            {/* PDF */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToPDF({
                                                            key: "Maharashtra Districts Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                    className="hover:cursor-pointer"
                                                >
                                                    <img height={22} width={22} src={pdf} alt="PDF" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-16 p-1 rounded-md ">
                                                    Download PDF
                                                </div>
                                            </div>
                                        </div>

                                        {/* ========== District Table ========== */}
                                        <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 border-b font-semibold">Sr. no.</th>
                                                    <th className="p-2 border-b font-semibold">Districts</th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        ULB Count
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total Houses
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Active Employees
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total House Scan
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Dump Trips
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ulbs?.map((div, ind) => (
                                                    <tr key={ind} className="hover:bg-gray-50">
                                                        <td className="p-2 border-b font-medium">{ind + 1}</td>
                                                        <td className="p-2 border-b font-medium">{div.ulbName}</td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.ulbCount.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouse.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalActiveEmp.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouseScan.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalDumpTrip.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* ✅ Summary Row */}
                                                <tr className="bg-gray-200 font-semibold">
                                                    <td className="p-2 border-t text-left" colSpan={2}>
                                                        Total
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.ulbCount, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalHouse, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalActiveEmp, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalHouseScan, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalDumpTrip, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </>
                                ) : isDivisionLevel && allDivisionsStats?.length > 0 ? (
                                    <>
                                        {/* ===== Divisions Table ===== */}
                                        <h4 className="text-lg sm:text-xl font-bold mb-3 px-2 text-gray-900">
                                            Maharashtra Divisions Summary
                                        </h4>

                                        <div className="relative  flex justify-end space-x-3 px-2 mb-2">
                                            {/* Excel */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToExcel({
                                                            key: "Maharashtra Divisions Summary",
                                                            data: allDivisionsStats,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={excel} alt="Excel" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-24 p-1 rounded-md">
                                                    Download Excel
                                                </div>
                                            </div>

                                            {/* PDF */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToPDF({
                                                            key: "Maharashtra Divisions Summary",
                                                            data: allDivisionsStats,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={pdf} alt="PDF" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-16 p-1 rounded-md">
                                                    Download PDF
                                                </div>
                                            </div>
                                        </div>

                                        <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 border-b font-semibold">Sr. no.</th>
                                                    <th className="p-2 border-b font-semibold">Divisions</th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        ULB Count
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total Houses
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Active Employees
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total House Scan
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Dump Trips
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allDivisionsStats.map((div, index) => (
                                                    <tr key={index} className="hover:bg-gray-50">
                                                        <td className="p-2 border-b font-medium">{index + 1}</td>
                                                        <td className="p-2 border-b font-medium">{div.name}</td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.ulbCount.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouse.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalActiveEmp.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouseScan.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalDumpTrip.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* Totals Row */}
                                                <tr className="bg-gray-200 font-semibold">
                                                    <td className="p-2 border-t text-left" colSpan={2}>
                                                        Total
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {allDivisionsStats
                                                            .reduce((sum, div) => sum + div.ulbCount, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {allDivisionsStats
                                                            .reduce((sum, div) => sum + div.totalHouse, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {allDivisionsStats
                                                            .reduce((sum, div) => sum + div.totalActiveEmp, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {allDivisionsStats
                                                            .reduce((sum, div) => sum + div.totalHouseScan, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {allDivisionsStats
                                                            .reduce((sum, div) => sum + div.totalDumpTrip, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </>
                                ) : tableUlbData?.length > 0 ? (
                                    <>
                                        {/* ===== ULB Table ===== */}
                                        <h2 className="text-base sm:text-lg font-semibold mb-3 px-2 text-gray-800">
                                            {currentDistrict} ULB Details
                                        </h2>

                                        <div className="relative  flex justify-end space-x-3 px-2 mb-2">
                                            {/* Excel */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToExcel({
                                                            key: "Maharashtra Ulb Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={excel} alt="Excel" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-24 p-1 rounded-md">
                                                    Download Excel
                                                </div>
                                            </div>

                                            {/* PDF */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToPDF({
                                                            key: "Maharashtra Ulb Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={pdf} alt="PDF" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-16 p-1 rounded-md">
                                                    Download PDF
                                                </div>
                                            </div>
                                        </div>

                                        <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 border-b font-semibold">Sr. no.</th>
                                                    <th className="p-2 border-b font-semibold">ULBs</th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total Houses
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Active Employees
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total House Scan
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Dump Trips
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tableUlbData?.map((div, ind) => (
                                                    <tr key={ind} className="hover:bg-gray-50">
                                                        <td className="p-2 border-b font-medium">{ind + 1}</td>
                                                        <td className="p-2 border-b font-medium">{div.ulbName}</td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouse.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalActiveEmp.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouseScan.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalDumpTrip.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* ✅ Total Row */}
                                                <tr className="bg-gray-200 font-semibold">
                                                    <td className="p-2 border-t text-left" colSpan={2}>
                                                        Total
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {tableUlbData
                                                            ?.reduce((sum, div) => sum + div.totalHouse, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {tableUlbData
                                                            ?.reduce((sum, div) => sum + div.totalActiveEmp, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {tableUlbData
                                                            ?.reduce((sum, div) => sum + div.totalHouseScan, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {tableUlbData
                                                            ?.reduce((sum, div) => sum + div.totalDumpTrip, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </>
                                ) : (
                                    <>
                                        {/* ===== Default Division Table ===== */}
                                        <h2 className="text-base sm:text-lg font-semibold mb-3 px-2 text-gray-800">
                                            {parentName} Division Details
                                        </h2>

                                        <div className="relative  flex justify-end space-x-3 px-2 mb-2">
                                            {/* Excel */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToExcel({
                                                            key: "Maharashtra Default Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={excel} alt="Excel" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-24 p-1 rounded-md">
                                                    Download Excel
                                                </div>
                                            </div>

                                            {/* PDF */}
                                            <div className="relative group">
                                                <button
                                                    onClick={() =>
                                                        handleExportToPDF({
                                                            key: "Maharashtra Default Summary",
                                                            data: ulbs,
                                                        })
                                                    }
                                                >
                                                    <img height={22} width={22} src={pdf} alt="PDF" />
                                                </button>
                                                <div className="absolute hidden group-hover:flex bottom-[130%] left-1/2 -translate-x-1/2 bg-[#f5f5f5] text-gray-600 font-semibold shadow-lg justify-center items-center text-[10px] w-16 p-1 rounded-md">
                                                    Download PDF
                                                </div>
                                            </div>
                                        </div>

                                        <table className="w-full text-xs sm:text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="p-2 border-b font-semibold">Sr. no.</th>
                                                    <th className="p-2 border-b font-semibold">District</th>
                                                    <th className="p-2 border-b font-semibold">ULB Count</th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total Houses
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Active Employees
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Total House Scan
                                                    </th>
                                                    <th className="p-2 border-b font-semibold text-center">
                                                        Dump Trips
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ulbs?.map((div, ind) => (
                                                    <tr key={ind} className="hover:bg-gray-50">
                                                        <td className="p-2 border-b font-medium">{ind + 1}</td>
                                                        <td className="p-2 border-b font-medium">{div.ulbName}</td>
                                                        <td className="p-2 border-b text-center font-medium">
                                                            {div.ulbCount}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouse.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalActiveEmp.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalHouseScan.toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border-b text-center">
                                                            {div.totalDumpTrip.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}

                                                {/* ✅ Total Row */}
                                                <tr className="bg-gray-200 font-semibold">
                                                    <td className="p-2 border-t text-left" colSpan={2}>
                                                        Total
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.ulbCount, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalHouse, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalActiveEmp, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalHouseScan, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                    <td className="p-2 border-t text-center">
                                                        {ulbs
                                                            ?.reduce((sum, div) => sum + div.totalDumpTrip, 0)
                                                            .toLocaleString()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

            </div>
        </div>

    );

};
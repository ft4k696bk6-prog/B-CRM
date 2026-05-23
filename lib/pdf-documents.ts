"use client";

import type { ContractCustomerRecord } from "@/lib/contract-documents";

export type AnnexValues = {
  panelsCount: string;
  installationPowerKw: string;
  grossPrice: string;
  financing: string;
};

type DocumentType = "contract" | "annex" | "invoice";

const page = {
  width: 1240,
  height: 1754,
  margin: 92
};

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = page.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Nie udało się przygotować dokumentu PDF.");
  return { canvas, context };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    size?: number;
    weight?: string;
    color?: string;
    maxWidth?: number;
    lineHeight?: number;
  } = {}
) {
  const size = options.size || 28;
  const lineHeight = options.lineHeight || size * 1.35;
  context.font = `${options.weight || "400"} ${size}px Arial, Helvetica, sans-serif`;
  context.fillStyle = options.color || "#10131a";

  const lines = options.maxWidth ? wrapText(context, text, options.maxWidth) : [text];
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawRule(context: CanvasRenderingContext2D, y: number) {
  context.strokeStyle = "#dbe2ea";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(page.margin, y);
  context.lineTo(page.width - page.margin, y);
  context.stroke();
}

function drawField(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  context.fillStyle = "#f7fafc";
  context.strokeStyle = "#dbe2ea";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(x, y, width, 104, 14);
  context.fill();
  context.stroke();

  drawText(context, label.toUpperCase(), x + 24, y + 34, {
    size: 18,
    weight: "700",
    color: "#5f6f82",
    maxWidth: width - 48
  });
  drawText(context, value || "-", x + 24, y + 74, {
    size: 24,
    weight: "700",
    color: "#10131a",
    maxWidth: width - 48,
    lineHeight: 28
  });
}

function drawHeader(context: CanvasRenderingContext2D, title: string, subtitle: string) {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.width, page.height);
  context.fillStyle = "#10131a";
  context.fillRect(0, 0, page.width, 238);
  context.fillStyle = "#f5b642";
  context.fillRect(page.margin, 54, 116, 12);
  drawText(context, "B-CRM", page.margin, 126, {
    size: 54,
    weight: "900",
    color: "#ffffff"
  });
  drawText(context, title, page.margin, 188, {
    size: 34,
    weight: "800",
    color: "#ffffff",
    maxWidth: 680
  });
  drawText(context, subtitle, page.width - 420, 104, {
    size: 22,
    weight: "700",
    color: "#dbe2ea",
    maxWidth: 330,
    lineHeight: 30
  });
}

function drawContract(context: CanvasRenderingContext2D, data: ContractCustomerRecord) {
  drawHeader(context, "Umowa kompleksowa OZE", `Numer: ${data.contractNumber}\nData: ${data.contractDate}`);

  let y = 302;
  drawText(context, "Strony umowy", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Sprzedawca", data.companyName, page.margin, y, 500);
  drawField(context, "NIP", data.companyNip, page.margin + 530, y, 260);
  drawField(context, "Opiekun", data.sellerName, page.margin + 820, y, 236);
  y += 132;
  drawField(context, "Klient", data.clientName, page.margin, y, 500);
  drawField(context, "PESEL", data.pesel, page.margin + 530, y, 260);
  drawField(context, "Telefon", data.phone, page.margin + 820, y, 236);
  y += 132;
  drawField(context, "Adres inwestycji", `${data.address}, ${data.postalCode} ${data.city}`, page.margin, y, 640);
  drawField(context, "E-mail", data.email, page.margin + 670, y, 386);

  y += 172;
  drawText(context, "Zakres i parametry instalacji", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Moc instalacji", `${data.installationPowerKw} kW`, page.margin, y, 330);
  drawField(context, "Liczba paneli", data.panelsCount, page.margin + 360, y, 330);
  drawField(context, "Falownik", data.inverterModel, page.margin + 720, y, 336);
  y += 132;
  drawField(context, "Cena netto", data.netPrice, page.margin, y, 330);
  drawField(context, "Cena brutto", data.grossPrice, page.margin + 360, y, 330);
  drawField(context, "Finansowanie", data.financing, page.margin + 720, y, 336);
  y += 132;
  drawField(context, "Rata", data.creditInstallment, page.margin, y, 330);
  drawField(context, "Termin montażu", data.montageDate, page.margin + 360, y, 330);
  drawField(context, "Uwagi", data.warehouseNote, page.margin + 720, y, 336);

  y += 178;
  drawText(
    context,
    "Dokument jest prezentowany na podstawie danych w CRM. Umowa pozostaje w bezpiecznym podglądzie, bez automatycznego pobierania danych klienta.",
    page.margin,
    y,
    { size: 24, color: "#334155", maxWidth: page.width - page.margin * 2, lineHeight: 34 }
  );
}

function drawAnnex(
  context: CanvasRenderingContext2D,
  data: ContractCustomerRecord,
  annexValues: AnnexValues,
  selectedChanges: string[],
  annexMode: "manual" | "automatic"
) {
  drawHeader(context, "Aneks do umowy", `Do umowy: ${data.contractNumber}\nTryb: ${annexMode === "automatic" ? "automatyczny" : "ręczny"}`);

  let y = 302;
  drawText(context, "Dane klienta", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Klient", data.clientName, page.margin, y, 500);
  drawField(context, "Adres", `${data.address}, ${data.postalCode} ${data.city}`, page.margin + 530, y, 526);
  y += 154;

  drawText(context, "Zakres zmian", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  const changes = selectedChanges.length > 0 ? selectedChanges : ["Brak wskazanych zmian"];
  changes.forEach((change, index) => {
    drawText(context, `${index + 1}. ${change}`, page.margin + 16, y + index * 42, {
      size: 25,
      weight: "700",
      color: "#10131a",
      maxWidth: page.width - page.margin * 2
    });
  });

  y += Math.max(90, changes.length * 42 + 44);
  drawText(context, "Nowe parametry po aneksie", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Liczba paneli", annexValues.panelsCount, page.margin, y, 250);
  drawField(context, "Moc instalacji", `${annexValues.installationPowerKw} kW`, page.margin + 280, y, 250);
  drawField(context, "Cena brutto", annexValues.grossPrice, page.margin + 560, y, 250);
  drawField(context, "Finansowanie", annexValues.financing, page.margin + 840, y, 216);

  y += 172;
  drawText(
    context,
    "Pozostałe postanowienia umowy pozostają bez zmian. Aneks wygenerowano automatycznie z CRM na podstawie danych zatwierdzonych w procesie realizacji.",
    page.margin,
    y,
    { size: 24, color: "#334155", maxWidth: page.width - page.margin * 2, lineHeight: 34 }
  );

  y = page.height - 250;
  drawRule(context, y);
  drawText(context, "Podpis klienta", page.margin + 40, y + 90, { size: 22, color: "#5f6f82" });
  drawText(context, "Podpis sprzedawcy", page.width - 390, y + 90, { size: 22, color: "#5f6f82" });
}

function drawInvoice(context: CanvasRenderingContext2D, data: ContractCustomerRecord) {
  drawHeader(context, "Faktura VAT", `Umowa: ${data.contractNumber}\nData: ${data.contractDate}`);

  let y = 302;
  drawText(context, "Dane rozliczeniowe", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Sprzedawca", data.companyName, page.margin, y, 500);
  drawField(context, "NIP", data.companyNip, page.margin + 530, y, 260);
  drawField(context, "Numer umowy", data.contractNumber, page.margin + 820, y, 236);
  y += 132;
  drawField(context, "Nabywca", data.clientName, page.margin, y, 500);
  drawField(context, "Telefon", data.phone, page.margin + 530, y, 260);
  drawField(context, "E-mail", data.email, page.margin + 820, y, 236);
  y += 132;
  drawField(context, "Adres inwestycji", `${data.address}, ${data.postalCode} ${data.city}`, page.margin, y, 640);
  drawField(context, "Finansowanie", data.financing, page.margin + 670, y, 386);

  y += 172;
  drawText(context, "Pozycje faktury", page.margin, y, { size: 32, weight: "900" });
  y += 34;
  drawRule(context, y);
  y += 40;

  drawField(context, "Usługa", "Instalacja OZE wraz z montażem", page.margin, y, 500);
  drawField(context, "Netto", data.netPrice, page.margin + 530, y, 250);
  drawField(context, "Brutto", data.grossPrice, page.margin + 810, y, 246);
  y += 148;
  drawField(context, "Termin montażu", data.montageDate, page.margin, y, 330);
  drawField(context, "Moc instalacji", `${data.installationPowerKw} kW`, page.margin + 360, y, 330);
  drawField(context, "Panele", data.panelsCount, page.margin + 720, y, 336);

  y += 178;
  drawText(
    context,
    "Faktura została przygotowana w CRM na podstawie zatwierdzonej umowy. Eksport faktury jest dostępny wyłącznie dla księgowości, administratora i właściciela.",
    page.margin,
    y,
    { size: 24, color: "#334155", maxWidth: page.width - page.margin * 2, lineHeight: 34 }
  );
}

function fileName(type: DocumentType, data: ContractCustomerRecord) {
  const safeNumber = data.contractNumber.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  const prefix = type === "contract" ? "umowa" : type === "annex" ? "aneks" : "faktura";
  return `${prefix}-${safeNumber || "b-crm"}.pdf`;
}

async function downloadPdf(canvas: HTMLCanvasElement, type: DocumentType, data: ContractCustomerRecord) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
  pdf.save(fileName(type, data));
}

export async function downloadAnnexPdf(
  data: ContractCustomerRecord,
  annexValues: AnnexValues,
  selectedChanges: string[],
  annexMode: "manual" | "automatic"
) {
  const { canvas, context } = createCanvas();
  drawAnnex(context, data, annexValues, selectedChanges, annexMode);
  await downloadPdf(canvas, "annex", data);
}

export async function downloadInvoicePdf(data: ContractCustomerRecord) {
  const { canvas, context } = createCanvas();
  drawInvoice(context, data);
  await downloadPdf(canvas, "invoice", data);
}

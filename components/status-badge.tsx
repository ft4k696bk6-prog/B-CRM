import { STATUS_LABELS, STATUS_TONES } from "@/lib/constants";
import { useLanguage } from "@/components/language-provider";
import type { LeadStatus } from "@/lib/types";

const STATUS_LABELS_EN: Record<LeadStatus, string> = {
  Nowy: "New",
  "Call back": "Call-back",
  Spotkanie: "Meeting",
  "Po spotkaniu": "After meeting",
  Umowa: "Contract",
  Rezygnacja: "Resignation",
  "Nie odebrał": "No answer"
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { language } = useLanguage();

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ${STATUS_TONES[status]}`}
    >
      {language === "en" ? STATUS_LABELS_EN[status] : STATUS_LABELS[status]}
    </span>
  );
}

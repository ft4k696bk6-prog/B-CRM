import type { LeadStatus } from "@/lib/types";

export const LEAD_STATUSES: LeadStatus[] = [
  "Nowy",
  "Nie odebrał",
  "Call back",
  "Spotkanie",
  "Po spotkaniu",
  "Umowa",
  "Rezygnacja"
];

export const STATUS_TONES: Record<LeadStatus, string> = {
  Nowy: "bg-sky/10 text-sky border-sky/25",
  "Call back": "bg-solar/15 text-solar border-solar/30",
  Spotkanie: "bg-leaf/10 text-leaf border-leaf/25",
  "Po spotkaniu": "bg-leaf/10 text-leaf border-leaf/25",
  Umowa: "bg-leaf/15 text-leaf border-leaf/30",
  Rezygnacja: "bg-danger/10 text-danger border-danger/25",
  "Nie odebrał": "bg-warn/10 text-warn border-warn/25",
};

export const STATUS_LABELS: Record<LeadStatus, string> = {
  Nowy: "Nowy",
  "Call back": "Call-back",
  Spotkanie: "Spotkanie",
  "Po spotkaniu": "Po spotkaniu",
  Umowa: "Umowa",
  Rezygnacja: "Rezygnacja",
  "Nie odebrał": "Nie odebrał",
};

export const ACTION_LABELS: Record<string, string> = {
  comment: "Komentarz",
  status_change: "Zmiana statusu",
  callback_scheduled: "Call-back zaplanowany",
  meeting_scheduled: "Spotkanie zaplanowane",
  meeting_address_changed: "Adres spotkania",
  contract_number_set: "Numer umowy",
  resignation_recorded: "Rezygnacja",
  file_uploaded: "Plik przesłany",
  file_deleted: "Plik usunięty",
  assigned: "Przypisanie",
  unassigned: "Odznaczenie",
  lead_created: "Dodanie leada",
  callback_set: "Call-back",
  meeting_set: "Spotkanie",
  meeting_address: "Adres spotkania",
  meeting_note: "Notatka po spotkaniu",
  return: "Zwrot",
  resignation: "Rezygnacja",
  assignment: "Przypisanie",
  contract_number: "Numer umowy"
};

export const STATUS_TILE_TONES: Record<LeadStatus, string> = {
  Nowy: "border-sky/30 bg-sky/10 text-sky hover:border-sky",
  "Call back": "border-solar/35 bg-solar/15 text-solar hover:border-solar",
  Spotkanie: "border-leaf/30 bg-leaf/10 text-leaf hover:border-leaf",
  "Po spotkaniu": "border-leaf/30 bg-leaf/10 text-leaf hover:border-leaf",
  Umowa: "border-leaf/35 bg-leaf/15 text-leaf hover:border-leaf",
  Rezygnacja: "border-danger/30 bg-danger/10 text-danger hover:border-danger",
  "Nie odebrał": "border-warn/30 bg-warn/10 text-warn hover:border-warn",
};

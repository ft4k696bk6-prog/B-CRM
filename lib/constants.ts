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
  Nowy: "bg-sky/10 text-sky border-sky/20",
  "Call back": "bg-solar/20 text-[#8a5a00] border-solar/30",
  Spotkanie: "bg-[#e8f7f0] text-[#1d7556] border-[#bfe8d5]",
  "Po spotkaniu": "bg-[#edf7f2] text-[#226b59] border-[#c8e8dc]",
  Umowa: "bg-[#eef8e8] text-[#31701f] border-[#cde9c2]",
  Rezygnacja: "bg-danger/10 text-danger border-danger/20",
  "Nie odebrał": "bg-warn/10 text-warn border-warn/20",
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
  "Call back": "border-solar/40 bg-solar/20 text-[#8a5a00] hover:border-solar",
  Spotkanie: "border-[#9dddbf] bg-[#e8f7f0] text-[#1d7556] hover:border-leaf",
  "Po spotkaniu": "border-[#a9ded1] bg-[#edf7f2] text-[#226b59] hover:border-[#4fb391]",
  Umowa: "border-[#97d49b] bg-[#e9f8eb] text-[#277333] hover:border-[#4cae55]",
  Rezygnacja: "border-danger/30 bg-danger/10 text-danger hover:border-danger",
  "Nie odebrał": "border-warn/30 bg-warn/10 text-warn hover:border-warn",
};

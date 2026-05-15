import type { LeadStatus } from "@/lib/types";

export const LEAD_STATUSES: LeadStatus[] = [
  "Nowy",
  "Przypisany",
  "Call back",
  "Spotkanie",
  "Po spotkaniu",
  "Umowa",
  "Zwrot",
  "Rezygnacja",
  "Nie odebrał",
  "Błędny numer",
  "Do weryfikacji"
];

export const STATUS_TONES: Record<LeadStatus, string> = {
  Nowy: "bg-sky/10 text-sky border-sky/20",
  Przypisany: "bg-leaf/10 text-leaf border-leaf/20",
  "Call back": "bg-solar/20 text-[#8a5a00] border-solar/30",
  Spotkanie: "bg-[#e8f7f0] text-[#1d7556] border-[#bfe8d5]",
  "Po spotkaniu": "bg-[#edf7f2] text-[#226b59] border-[#c8e8dc]",
  Umowa: "bg-[#eef8e8] text-[#31701f] border-[#cde9c2]",
  Zwrot: "bg-[#f2f4f7] text-muted border-line",
  Rezygnacja: "bg-danger/10 text-danger border-danger/20",
  "Nie odebrał": "bg-warn/10 text-warn border-warn/20",
  "Błędny numer": "bg-[#f7e8e8] text-danger border-[#e9c3c3]",
  "Do weryfikacji": "bg-[#edf0ff] text-[#4254b8] border-[#cfd6ff]"
};

export const ACTION_LABELS: Record<string, string> = {
  comment: "Komentarz",
  status_change: "Zmiana statusu",
  callback_set: "Callback",
  meeting_set: "Spotkanie",
  meeting_address: "Adres spotkania",
  meeting_note: "Notatka po spotkaniu",
  return: "Zwrot",
  resignation: "Rezygnacja",
  assignment: "Przypisanie",
  contract_number: "Numer umowy",
  lead_created: "Dodanie leada"
};

export const STATUS_TILE_TONES: Record<LeadStatus, string> = {
  Nowy: "border-sky/30 bg-sky/10 text-sky hover:border-sky",
  Przypisany: "border-leaf/30 bg-leaf/10 text-leaf hover:border-leaf",
  "Call back": "border-solar/40 bg-solar/20 text-[#8a5a00] hover:border-solar",
  Spotkanie: "border-[#9dddbf] bg-[#e8f7f0] text-[#1d7556] hover:border-leaf",
  "Po spotkaniu": "border-[#a9ded1] bg-[#edf7f2] text-[#226b59] hover:border-[#4fb391]",
  Umowa: "border-[#97d49b] bg-[#e9f8eb] text-[#277333] hover:border-[#4cae55]",
  Zwrot: "border-line bg-[#f2f4f7] text-muted hover:border-muted",
  Rezygnacja: "border-danger/30 bg-danger/10 text-danger hover:border-danger",
  "Nie odebrał": "border-warn/30 bg-warn/10 text-warn hover:border-warn",
  "Błędny numer": "border-danger/30 bg-[#f7e8e8] text-danger hover:border-danger",
  "Do weryfikacji": "border-[#bfc8ff] bg-[#edf0ff] text-[#4254b8] hover:border-[#6c7cf0]"
};

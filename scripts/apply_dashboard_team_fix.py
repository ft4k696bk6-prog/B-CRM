from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


admin_path = Path("app/admin/page.tsx")
admin = admin_path.read_text()

admin = replace_once(
    admin,
    '  const [campaignOptions, setCampaignOptions] = useState<string[]>([]);\n  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);',
    '  const [campaignOptions, setCampaignOptions] = useState<string[]>([]);\n  const [teamPerformanceLeads, setTeamPerformanceLeads] = useState<Array<Pick<Lead, "id" | "phone" | "status" | "assigned_to" | "callback_at" | "meeting_at">>>([]);\n  const [filters, setFilters] = useState<AdminLeadFilters>(initialFilters);',
    "team performance state",
)

team_loader = '''  const loadTeamPerformanceLeads = useCallback(async () => {
    if (!crmEnvironment || !salespeopleReady) return;

    const allLeads: Array<Pick<Lead, "id" | "phone" | "status" | "assigned_to" | "callback_at" | "meeting_at">> = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
      let query = supabase
        .from("leads")
        .select("id,phone,status,assigned_to,callback_at,meeting_at")
        .eq("crm_environment", crmEnvironment)
        .not("assigned_to", "is", null)
        .range(from, from + pageSize - 1);

      if (isManager) {
        const scopedIds = salespeople.map((person) => person.id);
        if (!scopedIds.length) {
          setTeamPerformanceLeads([]);
          return;
        }
        query = query.in("assigned_to", scopedIds);
      }

      const { data, error: teamError } = await query;
      if (teamError) {
        setError(teamError.message);
        return;
      }

      const page = (data || []) as Array<Pick<Lead, "id" | "phone" | "status" | "assigned_to" | "callback_at" | "meeting_at">>;
      allLeads.push(...page);

      if (page.length < pageSize) break;
      from += pageSize;
    }

    setTeamPerformanceLeads(allLeads);
  }, [crmEnvironment, isManager, salespeople, salespeopleReady]);

'''

admin = replace_once(
    admin,
    '  const loadStats = useCallback(async () => {',
    team_loader + '  const loadStats = useCallback(async () => {',
    "team performance loader",
)

admin = replace_once(
    admin,
    '  useEffect(() => {\n    if (!salespeopleReady) return;\n    loadStats();\n  }, [loadStats, salespeopleReady]);\n\n  useEffect(() => {\n    if (!salespeopleReady) return;\n    void loadCampaignOptions();',
    '  useEffect(() => {\n    if (!salespeopleReady) return;\n    loadStats();\n  }, [loadStats, salespeopleReady]);\n\n  useEffect(() => {\n    if (!salespeopleReady) return;\n    void loadTeamPerformanceLeads();\n  }, [loadTeamPerformanceLeads, salespeopleReady]);\n\n  useEffect(() => {\n    if (!salespeopleReady) return;\n    void loadCampaignOptions();',
    "team performance effect",
)

admin = replace_once(
    admin,
    '    const refreshCurrentView = () => { void Promise.all([loadLeads(), loadStats(), loadCampaignOptions()]); };',
    '    const refreshCurrentView = () => { void Promise.all([loadLeads(), loadStats(), loadCampaignOptions(), loadTeamPerformanceLeads()]); };',
    "refresh team performance",
)

admin = replace_once(
    admin,
    '  }, [loadCampaignOptions, loadLeads, loadStats, salespeopleReady]);',
    '  }, [loadCampaignOptions, loadLeads, loadStats, loadTeamPerformanceLeads, salespeopleReady]);',
    "refresh dependencies",
)

admin = replace_once(
    admin,
    '      for (const lead of leads) {',
    '      for (const lead of teamPerformanceLeads) {',
    "team performance source",
)

admin = replace_once(
    admin,
    '        const phoneKey = lead.phone.replace(/\\D/g, "").slice(-9) || lead.id;\n\n        row.leadKeys.add(phoneKey);\n        if (lead.status === "Spotkanie") row.meetingKeys.add(phoneKey);\n        if (lead.status === "Umowa") row.contractKeys.add(phoneKey);\n        if (lead.status === "Call back" && lead.callback_at && new Date(lead.callback_at).getTime() < now) {\n          row.overdueCallbackKeys.add(phoneKey);\n        }\n        if (needsNextAction(lead)) row.noNextActionKeys.add(phoneKey);',
    '        const leadKey = lead.id;\n\n        row.leadKeys.add(leadKey);\n        if (lead.status === "Spotkanie") row.meetingKeys.add(leadKey);\n        if (lead.status === "Umowa") row.contractKeys.add(leadKey);\n        if (lead.status === "Call back" && lead.callback_at && new Date(lead.callback_at).getTime() < now) {\n          row.overdueCallbackKeys.add(leadKey);\n        }\n        if (needsNextAction(lead)) row.noNextActionKeys.add(leadKey);',
    "count lead records by id",
)

admin = replace_once(
    admin,
    '    [leads, salespeople]\n  );',
    '    [salespeople, teamPerformanceLeads]\n  );',
    "team performance dependencies",
)

admin = replace_once(
    admin,
    '        teamDescription: `${teamPerformance.length} handlowców w aktualnym widoku. Szczegóły są schowane, żeby dashboard został zwarty.`,',
    '        teamDescription: `${teamPerformance.length} osób w zespole. Wyniki są liczone ze wszystkich leadów przypisanych w CRM, niezależnie od aktualnie załadowanej strony.`,',
    "Polish team description",
)

admin = replace_once(
    admin,
    '        teamDescription: `${teamPerformance.length} salespeople in the current view. Details stay collapsed so the dashboard stays focused.`,',
    '        teamDescription: `${teamPerformance.length} team members. Results are calculated from all assigned leads in the CRM, regardless of the currently loaded page.`,',
    "English team description",
)

admin_path.write_text(admin)

shell_path = Path("components/app-shell.tsx")
shell = shell_path.read_text()
shell = replace_once(shell, '  Warehouse,\n', '', "Warehouse icon import")
shell = replace_once(shell, '    | "navEquipment"\n', '', "navEquipment key")
shell = replace_once(
    shell,
    '''  {
    href: "/equipment",
    labelKey: "navEquipment",
    groupKey: "operations",
    icon: Warehouse,
    allowedRoles: ["owner", "admin", "logistyk"],
    tourId: "tour-nav-equipment"
  },
''',
    '',
    "equipment navigation link",
)
shell_path.write_text(shell)

equipment_page = Path("app/equipment/page.tsx")
if equipment_page.exists():
    equipment_page.unlink()

Path("scripts/apply_dashboard_team_fix.py").unlink(missing_ok=True)
Path(".github/workflows/apply-dashboard-team-and-remove-equipment.yml").unlink(missing_ok=True)

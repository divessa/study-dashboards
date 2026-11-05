import { fixedStatuses, type Data, type Module } from "./model";
export const legacyPlan = (m: Module): Module["planStatus"] => m.planStatus ?? (fixedStatuses.includes(m.status) ? "Verbindlich" : m.status === "Warteliste" ? "Entscheidung offen" : m.status === "Abgewählt" ? "Nicht vorgesehen" : "Unverbindlich");
// Existing records are never modified automatically.
export function migrateData(input: Data, _previous?: Data): Data { return input; }

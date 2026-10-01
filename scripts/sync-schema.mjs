import fs from "node:fs";

const schemaPath = "lib/db/schema.sql";
let schema = fs.readFileSync(schemaPath, "utf8");
for (const file of ["0005_phase4_operations.sql", "0006_phase5_operations.sql", "0007_phase7_cutover.sql"]) {
  const migration = fs.readFileSync(`supabase/migrations/${file}`, "utf8");
  const marker = file.includes("0007")
    ? "create table if not exists organization_runtime"
    : file.includes("0006")
      ? "create table if not exists facilities"
      : "create table if not exists automations";
  if (!schema.includes(marker)) {
    schema = `${schema.trimEnd()}\n\n${migration}\n`;
  }
}
fs.writeFileSync(schemaPath, schema);
const body = fs.readFileSync(schemaPath, "utf8").replaceAll("`", "\\`").replaceAll("${", "\\${");
fs.writeFileSync(
  "lib/db/schema-sql.ts",
  `// Applied on Neon. This string matches lib/db/schema.sql.\nexport const schemaSql = \`${body.replace(/\r?\n$/, "")}\`;\n`,
);
console.log("schema synced");

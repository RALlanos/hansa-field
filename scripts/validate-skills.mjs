import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), ".agents", "skills");
const folders = await readdir(root, { withFileTypes: true });
const errors = [];

for (const folder of folders.filter((entry) => entry.isDirectory())) {
  const skill = await readFile(join(root, folder.name, "SKILL.md"), "utf8");
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!frontmatter) {
    errors.push(`${folder.name}: falta frontmatter YAML.`);
    continue;
  }
  const name = frontmatter[1].match(/^name:\s*([^\r\n]+)$/m)?.[1]?.trim();
  const description = frontmatter[1]
    .match(/^description:\s*([^\r\n]+)$/m)?.[1]
    ?.trim();
  if (name !== folder.name)
    errors.push(`${folder.name}: name debe coincidir con la carpeta.`);
  if (!description) errors.push(`${folder.name}: falta description.`);
  if (skill.trim().split(/\r?\n/).length < 8)
    errors.push(`${folder.name}: instrucciones insuficientes.`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Skills válidas: ${folders.filter((entry) => entry.isDirectory()).length}\n`,
  );
}

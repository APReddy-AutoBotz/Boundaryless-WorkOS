import fs from "node:fs/promises";
import path from "node:path";

const playwrightPath =
  "file:///C:/Users/mailt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const { chromium } = await import(playwrightPath);

const rootDir = path.resolve("artifacts/leadership-demo");
const screenshotDir = path.join(rootDir, "screenshots");
const baseUrl = process.env.RUT_DEMO_URL || "http://localhost:3000";

await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
const captured = [];

async function settle() {
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.addStyleTag({
    content: `
      * { caret-color: transparent !important; }
      html { scroll-behavior: auto !important; }
      body { animation-duration: 0.01ms !important; }
    `,
  }).catch(() => {});
}

async function screenshot(name, description) {
  await settle();
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  captured.push({ name, description, file });
}

async function goto(route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await settle();
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function login() {
  await goto("/login");
  await screenshot("01-login-internal-access", "Internal login and role-based access screen");

  const shortcut = page.getByText("Admin-1", { exact: true });
  if (await shortcut.count()) {
    await shortcut.click();
  } else {
    await page.getByLabel("Username").fill("admin-1");
    await page.getByLabel("Password").fill("demo123");
  }

  await page.getByRole("button", { name: "Open Workspace" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
  await settle();
}

async function captureRoute(route, name, description, options = {}) {
  await goto(route);
  if (options.waitForText) {
    await page.getByText(options.waitForText, { exact: false }).first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  }
  if (options.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), options.scrollY).catch(() => {});
  }
  await screenshot(name, description);
}

await login();

const ids = await page.evaluate(() => {
  const read = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  };
  const employees = read("rt_employees");
  const projects = read("rt_projects");
  const allocations = read("rt_allocations");
  const employee =
    employees.find((emp) => emp.employeeId === "EMP-12") ||
    employees.find((emp) => Number(emp.activeProjectCount || 0) > 1) ||
    employees.find((emp) => emp.employeeId?.startsWith("EMP-")) ||
    employees[0];
  const project =
    projects.find((proj) => proj.status === "Active" && allocations.filter((alloc) => alloc.projectId === proj.id).length >= 4) ||
    projects.find((proj) => proj.status === "Active") ||
    projects[0];
  return {
    employeeId: employee?.id,
    projectId: project?.id,
  };
});

await captureRoute("/", "02-dashboard-command-center", "Overview dashboard with portfolio-level signals", { waitForText: "Operations Dashboard" });
await captureRoute("/clients", "03-client-portfolio-scope", "Client portfolio showing scope and concentration", { waitForText: "Client" });
await captureRoute("/employees", "04-employee-master", "Employee master list with governed people records", { waitForText: "Employee" });

if (ids.employeeId) {
  await captureRoute(`/employees/${ids.employeeId}`, "05-employee-detail", "Employee detail proving person-to-project traceability", { waitForText: "Allocation" });
}

if (ids.projectId) {
  await captureRoute(`/projects/${ids.projectId}`, "06-project-detail", "Project detail with assigned consultants and allocation percentages", { waitForText: "Assigned Consultants" });
}

await captureRoute("/allocations", "07-allocation-control", "Allocation Control showing planned utilization workflow", { waitForText: "Allocation" });
await captureRoute("/timesheets", "08-my-timesheet", "Weekly timesheet entry and submission workflow", { waitForText: "Timesheet" });
await captureRoute("/timesheets/approval", "09-timesheet-governance", "Timesheet governance and approval queue", { waitForText: "Approval" });
await captureRoute("/utilization/actual", "10-actual-utilization", "Actual utilization and planned-vs-actual variance", { waitForText: "Actual Utilization" });
await captureRoute("/admin", "11-governance-settings", "Governance settings, catalogs, and controlled master-data configuration", { waitForText: "Settings" });
await captureRoute("/audit-trail", "12-audit-trail", "Audit trail and traceability evidence", { waitForText: "Audit" });

await browser.close();

await fs.writeFile(
  path.join(screenshotDir, "manifest.json"),
  JSON.stringify({ baseUrl, viewport: "1600x900", captured }, null, 2),
  "utf8",
);

console.log(JSON.stringify({ screenshotDir, count: captured.length, captured }, null, 2));

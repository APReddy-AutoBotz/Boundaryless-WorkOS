import fs from "node:fs/promises";
import path from "node:path";

const artifactToolPath =
  "file:///C:/Users/mailt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const sharpPath =
  "file:///C:/Users/mailt/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/lib/index.js";

const {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  text,
  image,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  fr,
  auto,
} = await import(artifactToolPath);

const { default: sharp } = await import(sharpPath);

const rootDir = path.resolve("artifacts/leadership-demo");
const outputDir = path.join(rootDir, "output");
const previewDir = path.join(rootDir, "previews");
const layoutDir = path.join(rootDir, "layouts");
const screenshotDir = path.join(rootDir, "screenshots");
const publicDir = path.resolve("public");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(layoutDir, { recursive: true });

for (const dir of [previewDir, layoutDir]) {
  const files = await fs.readdir(dir).catch(() => []);
  await Promise.all(files.map((file) => fs.rm(path.join(dir, file), { recursive: true, force: true })));
}

const colors = {
  ink: "#003761",
  navy: "#08254A",
  orange: "#EF7D00",
  body: "#526375",
  muted: "#8B9AAF",
  line: "#D7DEE7",
  soft: "#F5F8FB",
  pale: "#FFF7EF",
  white: "#FFFFFF",
};

const fonts = {
  heading: "Trebuchet MS",
  body: "Aptos",
  mono: "Consolas",
};

const slideSize = { width: 1920, height: 1080 };
const frame = { left: 0, top: 0, width: slideSize.width, height: slideSize.height };

const shot = (name) => path.join(screenshotDir, `${name}.png`);
const imageDataUrls = new Map();

async function registerPng(file) {
  const absolute = path.resolve(file);
  const bytes = await fs.readFile(absolute);
  imageDataUrls.set(absolute, `data:image/png;base64,${bytes.toString("base64")}`);
}

const screenshotNames = [
  "01-login-internal-access",
  "02-dashboard-command-center",
  "03-client-portfolio-scope",
  "05-employee-detail",
  "06-project-detail",
  "07-allocation-control",
  "08-my-timesheet",
  "09-timesheet-governance",
  "10-actual-utilization",
  "11-governance-settings",
  "12-audit-trail",
];

for (const name of screenshotNames) {
  await registerPng(shot(name));
}
await registerPng(path.join(publicDir, "boundaryless-logo.png"));

function pngDataUrl(file) {
  const absolute = path.resolve(file);
  const value = imageDataUrls.get(absolute);
  if (!value) throw new Error(`Image not registered: ${absolute}`);
  return value;
}

function compose(slide, content) {
  slide.compose(content, { frame, baseUnit: 8 });
}

function kicker(value, options = {}) {
  return text(value.toUpperCase(), {
    name: options.name || `kicker.${value}`,
    width: wrap(options.width || 720),
    height: hug,
    style: {
      fontFace: fonts.body,
      fontSize: options.size || 17,
      bold: true,
      color: options.color || colors.orange,
      characterSpacing: 2.3,
    },
  });
}

function title(value, options = {}) {
  return text(value, {
    name: options.name || `title.${value.slice(0, 18)}`,
    width: wrap(options.width || 1280),
    height: hug,
    style: {
      fontFace: fonts.heading,
      fontSize: options.size || 54,
      bold: true,
      color: options.color || colors.ink,
      lineSpacing: 1.04,
    },
  });
}

function subtitle(value, options = {}) {
  return text(value, {
    name: options.name || `subtitle.${value.slice(0, 18)}`,
    width: wrap(options.width || 1220),
    height: hug,
    style: {
      fontFace: fonts.body,
      fontSize: options.size || 23,
      color: options.color || colors.body,
      lineSpacing: 1.2,
    },
  });
}

function titleBlock(k, t, s, options = {}) {
  return column(
    {
      name: options.name || "title-block",
      width: fill,
      height: hug,
      gap: options.gap || 14,
      columnSpan: options.columnSpan,
      rowSpan: options.rowSpan,
    },
    [
      kicker(k, { name: `${options.name || "title-block"}.kicker`, color: options.kickerColor, width: options.kickerWidth }),
      title(t, { name: `${options.name || "title-block"}.title`, width: options.titleWidth, size: options.titleSize, color: options.titleColor }),
      rule({ name: `${options.name || "title-block"}.rule`, width: fixed(options.ruleWidth || 180), stroke: colors.orange, weight: 5 }),
      subtitle(s, { name: `${options.name || "title-block"}.subtitle`, width: options.subtitleWidth, size: options.subtitleSize, color: options.subtitleColor }),
    ],
  );
}

function screenshotImage(name, options = {}) {
  return image({
    name: options.name || `screenshot.${name}`,
    dataUrl: pngDataUrl(shot(name)),
    width: options.width || fill,
    height: options.height || fill,
    fit: options.fit || "contain",
    alt: options.alt || `${name} screenshot`,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
  });
}

function logo(options = {}) {
  return image({
    name: options.name || "boundaryless.logo",
    dataUrl: pngDataUrl(path.join(publicDir, "boundaryless-logo.png")),
    width: fixed(options.width || 250),
    height: fixed(options.height || 58),
    fit: "contain",
    alt: "Boundaryless logo",
  });
}

function callout(label, body, options = {}) {
  return column(
    { name: options.name || `callout.${label}`, width: options.width || fill, height: hug, gap: 8 },
    [
      text(label.toUpperCase(), {
        name: `${options.name || `callout.${label}`}.label`,
        width: fill,
        height: hug,
        style: {
          fontFace: fonts.body,
          fontSize: options.labelSize || 15,
          bold: true,
          color: options.accent || colors.orange,
          characterSpacing: 1.9,
        },
      }),
      text(body, {
        name: `${options.name || `callout.${label}`}.body`,
        width: options.bodyWidth || fill,
        height: hug,
        style: {
          fontFace: options.bold ? fonts.heading : fonts.body,
          fontSize: options.bodySize || 24,
          bold: Boolean(options.bold),
          color: options.color || colors.ink,
          lineSpacing: 1.16,
        },
      }),
    ],
  );
}

function step(index, label, body) {
  return row(
    { name: `step.${index}`, width: fill, height: hug, gap: 18 },
    [
      text(String(index).padStart(2, "0"), {
        name: `step.${index}.num`,
        width: fixed(64),
        height: hug,
        style: { fontFace: fonts.mono, fontSize: 28, bold: true, color: colors.orange },
      }),
      callout(label, body, { name: `step.${index}.copy`, bodySize: 22 }),
    ],
  );
}

function footer(slideNo, textValue = "Boundaryless-WorkOS | Leadership demo") {
  return row(
    { name: `footer.${slideNo}`, width: fill, height: hug, gap: 24 },
    [
      rule({ name: `footer.${slideNo}.rule`, width: fixed(120), stroke: colors.orange, weight: 4 }),
      text(textValue, {
        name: `footer.${slideNo}.text`,
        width: fill,
        height: hug,
        style: { fontFace: fonts.body, fontSize: 13, color: colors.muted },
      }),
      text(String(slideNo).padStart(2, "0"), {
        name: `footer.${slideNo}.num`,
        width: fixed(48),
        height: hug,
        style: { fontFace: fonts.mono, fontSize: 13, bold: true, color: colors.muted },
      }),
    ],
  );
}

const presentation = Presentation.create({ slideSize });

// Slide 1
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-01.root",
      width: fill,
      height: fill,
      columns: [fr(0.82), fr(1.18)],
      rows: [auto, fr(1), auto],
      columnGap: 48,
      rowGap: 28,
      padding: { x: 82, y: 68 },
    },
    [
      logo({ name: "slide-01.logo", width: 285, height: 68 }),
      screenshotImage("02-dashboard-command-center", { name: "slide-01.dashboard", columnSpan: 1, rowSpan: 3, fit: "cover" }),
      column(
        { name: "slide-01.copy", width: fill, height: hug, gap: 24 },
        [
          kicker("Executive product demo"),
          title("Boundaryless-WorkOS", { width: 720, size: 56 }),
          subtitle("A production-oriented command center for capacity, client delivery, weekly evidence, and governance.", { width: 650, size: 28 }),
          rule({ name: "slide-01.rule", width: fixed(220), stroke: colors.orange, weight: 6 }),
          text("Signal -> drilldown -> action -> governance", {
            name: "slide-01.promise",
            width: wrap(650),
            height: hug,
            style: { fontFace: fonts.heading, fontSize: 32, bold: true, color: colors.ink },
          }),
        ],
      ),
      footer(1, "Built from live localhost screenshots captured at 1600x900"),
    ],
  ),
);

// Slide 2
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-02.root",
      width: fill,
      height: fill,
      columns: [fr(0.92), fr(1.08)],
      rows: [auto, fr(1), auto],
      columnGap: 58,
      rowGap: 28,
      padding: { x: 82, y: 68 },
    },
    [
      titleBlock(
        "Why this matters",
        "Utilization is only credible when the path from plan to approved effort is visible.",
        "The tracker turns scattered spreadsheets into a governed operating rhythm for leadership.",
        { name: "slide-02.title", titleWidth: 760, titleSize: 46, subtitleWidth: 700 },
      ),
      screenshotImage("01-login-internal-access", { name: "slide-02.login", rowSpan: 2, fit: "contain" }),
      column(
        { name: "slide-02.points", width: fill, height: hug, gap: 24 },
        [
          callout("One source of truth", "People, clients, projects, allocations, timesheets, and audit all sit in one operating model.", { bold: true }),
          rule({ width: fill, stroke: colors.line, weight: 2 }),
          callout("Role-based confidence", "Admin, HR, Country Director, PM, Team Lead, and Employee screens expose the right depth of data.", { bold: true }),
          rule({ width: fill, stroke: colors.line, weight: 2 }),
          callout("Production handover path", "Demo data can be replaced by real records while preserving stable IDs, links, and governance flow.", { bold: true }),
        ],
      ),
      footer(2),
    ],
  ),
);

// Slide 3
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-03.root",
      width: fill,
      height: fill,
      columns: [fr(1.35), fr(0.65)],
      rows: [auto, fr(1), auto],
      columnGap: 42,
      rowGap: 26,
      padding: { x: 72, y: 58 },
    },
    [
      titleBlock(
        "Command center",
        "Start every leadership review with portfolio health, not raw tables.",
        "The dashboard surfaces load, missing logs, risk projects, and Country Director scope before anyone drills down.",
        { name: "slide-03.title", titleWidth: 1120, subtitleWidth: 1040, titleSize: 43, columnSpan: 2 },
      ),
      screenshotImage("02-dashboard-command-center", { name: "slide-03.dashboard", fit: "contain" }),
      column(
        { name: "slide-03.callouts", width: fill, height: hug, gap: 28 },
        [
          callout("Signal", "Global KPIs show total people, eligible delivery capacity, utilization, and pending work.", { bold: true }),
          callout("Scope", "Country Director cards explain ownership without hiding multi-director employee mapping.", { bold: true }),
          callout("Action", "Immediate queues turn the dashboard into a follow-up surface, not a static report.", { bold: true }),
        ],
      ),
      footer(3),
    ],
  ),
);

// Slide 4
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-04.root",
      width: fill,
      height: fill,
      columns: [fr(0.62), fr(1.38)],
      rows: [auto, fr(1), auto],
      columnGap: 46,
      rowGap: 26,
      padding: { x: 72, y: 58 },
    },
    [
      titleBlock(
        "Client scope",
        "Country Directors need client and project scope, not one FTE count.",
        "This view helps leadership see where the workforce is concentrated and which clients carry the most delivery weight.",
        { name: "slide-04.title", titleWidth: 560, subtitleWidth: 560, titleSize: 36, subtitleSize: 20, rowSpan: 1 },
      ),
      screenshotImage("03-client-portfolio-scope", { name: "slide-04.clients", rowSpan: 2, fit: "contain" }),
      column(
        { name: "slide-04.points", width: fill, height: hug, gap: 26 },
        [
          callout("Client concentration", "Shows which clients have the largest active workforce footprint."),
          callout("Portfolio ownership", "Country Director mappings remain visible even when employees serve multiple scopes."),
          callout("Executive read", "A better leadership question than 'how many cards exist?' is 'where is our delivery capacity exposed?'"),
        ],
      ),
      footer(4),
    ],
  ),
);

// Slide 5
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-05.root",
      width: fill,
      height: fill,
      columns: [fr(1), fr(1)],
      rows: [auto, fr(1), auto],
      columnGap: 34,
      rowGap: 24,
      padding: { x: 70, y: 56 },
    },
    [
      titleBlock(
        "Traceability",
        "Every hyperlink should land on the exact operational object.",
        "Leadership trust improves when an employee, PM, project, client, or allocation link opens the owning detail screen at the right section.",
        { name: "slide-05.title", titleWidth: 1480, subtitleWidth: 1400, titleSize: 42, columnSpan: 2 },
      ),
      column(
        { name: "slide-05.employee", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("05-employee-detail", { name: "slide-05.employee.shot", height: fixed(610), fit: "contain" }),
          callout("Person view", "Employee record, home role, mapped directors, assignments, and utilization history.", { bodySize: 19 }),
        ],
      ),
      column(
        { name: "slide-05.project", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("06-project-detail", { name: "slide-05.project.shot", height: fixed(610), fit: "contain" }),
          callout("Project view", "PM ownership, assigned consultants, planned allocation, and project actuals.", { bodySize: 19 }),
        ],
      ),
      footer(5),
    ],
  ),
);

// Slide 6
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-06.root",
      width: fill,
      height: fill,
      columns: [fr(1.28), fr(0.72)],
      rows: [auto, fr(1), auto],
      columnGap: 42,
      rowGap: 24,
      padding: { x: 72, y: 58 },
    },
    [
      titleBlock(
        "Planned utilization",
        "Allocation Control is the transactional source of planned capacity.",
        "The right user experience is simple: choose person, project, role on project, date range, and percentage.",
        { name: "slide-06.title", titleWidth: 1440, subtitleWidth: 1280, titleSize: 42, columnSpan: 2 },
      ),
      screenshotImage("07-allocation-control", { name: "slide-06.allocations", fit: "contain" }),
      column(
        { name: "slide-06.points", width: fill, height: hug, gap: 24 },
        [
          callout("Editable where it belongs", "Planned percentage is controlled from allocation workflows and scoped detail actions."),
          callout("Date-aware", "Start and end dates decide whether capacity counts in current and forecast periods."),
          callout("PM included correctly", "Project Managers count only when they carry active project allocation."),
          callout("Governance users excluded", "Admin, HR, and Country Directors do not dilute delivery utilization averages."),
        ],
      ),
      footer(6),
    ],
  ),
);

// Slide 7
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-07.root",
      width: fill,
      height: fill,
      columns: [fr(1), fr(1)],
      rows: [auto, fr(1), auto],
      columnGap: 34,
      rowGap: 24,
      padding: { x: 70, y: 56 },
    },
    [
      titleBlock(
        "Actual utilization",
        "Weekly timesheets create approved delivery evidence.",
        "Actual utilization should never be guessed from project status. It should come from submitted, reviewed, and approved hours.",
        { name: "slide-07.title", titleWidth: 1480, subtitleWidth: 1420, titleSize: 40, columnSpan: 2 },
      ),
      column(
        { name: "slide-07.timesheet", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("08-my-timesheet", { name: "slide-07.timesheet.shot", height: fixed(600), fit: "contain" }),
          callout("Employee action", "Log weekly effort against assigned projects, save draft, then submit.", { bodySize: 19 }),
        ],
      ),
      column(
        { name: "slide-07.governance", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("09-timesheet-governance", { name: "slide-07.governance.shot", height: fixed(600), fit: "contain" }),
          callout("Approver action", "Approve, reject with reason, or keep pending review before actuals are trusted.", { bodySize: 19 }),
        ],
      ),
      footer(7),
    ],
  ),
);

// Slide 8
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-08.root",
      width: fill,
      height: fill,
      columns: [fr(1.18), fr(0.82)],
      rows: [auto, fr(1), auto],
      columnGap: 42,
      rowGap: 24,
      padding: { x: 72, y: 58 },
    },
    [
      titleBlock(
        "Decision model",
        "Planned, actual, and forecast utilization answer different executive questions.",
        "The strongest demo moment is showing that the variance view is not redundant: it reconciles expectation against approved delivery.",
        { name: "slide-08.title", titleWidth: 1440, subtitleWidth: 1320, titleSize: 42, columnSpan: 2 },
      ),
      screenshotImage("10-actual-utilization", { name: "slide-08.actual", fit: "contain" }),
      column(
        { name: "slide-08.model", width: fill, height: hug, gap: 26 },
        [
          step(1, "Planned", "What have we committed through allocations?"),
          rule({ width: fill, stroke: colors.line, weight: 2 }),
          step(2, "Actual", "What approved effort did people log?"),
          rule({ width: fill, stroke: colors.line, weight: 2 }),
          step(3, "Forecast", "Where will overload, bench, or roll-off pressure appear next?"),
        ],
      ),
      footer(8),
    ],
  ),
);

// Slide 9
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-09.root",
      width: fill,
      height: fill,
      columns: [fr(1), fr(1)],
      rows: [auto, fr(1), auto],
      columnGap: 34,
      rowGap: 24,
      padding: { x: 70, y: 56 },
    },
    [
      titleBlock(
        "Governance and traceability",
        "Production confidence comes from controlled settings, catalogs, audit history, and exportable evidence.",
        "This is the difference between a dashboard prototype and a product leadership can hand to operations.",
        { name: "slide-09.title", titleWidth: 1480, subtitleWidth: 1400, titleSize: 42, columnSpan: 2 },
      ),
      column(
        { name: "slide-09.settings", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("11-governance-settings", { name: "slide-09.settings.shot", height: fixed(590), fit: "contain" }),
          callout("Controlled change", "Roles, catalogs, thresholds, and user management sit under governed access.", { bodySize: 19 }),
        ],
      ),
      column(
        { name: "slide-09.audit", width: fill, height: fill, gap: 12 },
        [
          screenshotImage("12-audit-trail", { name: "slide-09.audit.shot", height: fixed(590), fit: "contain" }),
          callout("Traceable evidence", "Audit and exports help leadership trust what changed, who changed it, and when.", { bodySize: 19 }),
        ],
      ),
      footer(9),
    ],
  ),
);

// Slide 10
compose(
  presentation.slides.add(),
  grid(
    {
      name: "slide-10.root",
      width: fill,
      height: fill,
      columns: [fr(0.82), fr(1.18)],
      rows: [auto, fr(1), auto],
      columnGap: 50,
      rowGap: 28,
      padding: { x: 82, y: 68 },
    },
    [
      titleBlock(
        "Leadership ask",
        "Approve a structured UAT rollout using real operating cadence, not isolated feature testing.",
        "The product is ready to be demonstrated as an end-to-end utilization operating system.",
        { name: "slide-10.title", titleWidth: 760, subtitleWidth: 700, titleSize: 48 },
      ),
      grid(
        {
          name: "slide-10.evidence-grid",
          width: fill,
          height: fill,
          columns: [fr(1), fr(1)],
          rows: [fr(1), fr(1)],
          columnGap: 20,
          rowGap: 20,
          rowSpan: 2,
        },
        [
          screenshotImage("02-dashboard-command-center", { name: "slide-10.shot.dashboard", fit: "cover" }),
          screenshotImage("06-project-detail", { name: "slide-10.shot.project", fit: "cover" }),
          screenshotImage("07-allocation-control", { name: "slide-10.shot.allocation", fit: "cover" }),
          screenshotImage("09-timesheet-governance", { name: "slide-10.shot.governance", fit: "cover" }),
        ],
      ),
      column(
        { name: "slide-10.actions", width: fill, height: hug, gap: 24 },
        [
          callout("Week 1", "Validate master data and ownership mapping with Admin, HR, PM, and Country Director users."),
          callout("Week 2", "Run allocations, timesheets, approvals, and planned-vs-actual review using demo-to-real data replacement."),
          callout("Decision", "Confirm production database, named users, import sequence, and company SSO path after UAT."),
        ],
      ),
      footer(10, "Final leadership close: one product, one operating rhythm, one governed utilization story"),
    ],
  ),
);

const pptxPath = path.join(outputDir, "Boundaryless-WorkOS_Leadership_Demo_Screenshot_Driven.pptx");
const pptxBlob = await PresentationFile.exportPptx(presentation);
await pptxBlob.save(pptxPath);

const previews = [];
for (let index = 0; index < presentation.slides.count; index += 1) {
  const slide = presentation.slides.getItem(index);
  const pngBlob = await slide.export({ format: "png" });
  const pngPath = path.join(previewDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
  await fs.writeFile(pngPath, Buffer.from(await pngBlob.arrayBuffer()));
  previews.push(pngPath);

  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(
    path.join(layoutDir, `slide-${String(index + 1).padStart(2, "0")}.layout.json`),
    JSON.stringify(layout, null, 2),
    "utf8",
  );
}

const thumbWidth = 360;
const thumbHeight = 203;
const gutter = 22;
const cols = 5;
const rows = Math.ceil(previews.length / cols);
const composites = await Promise.all(
  previews.map(async (file, index) => ({
    input: await sharp(file).resize(thumbWidth, thumbHeight, { fit: "cover" }).png().toBuffer(),
    left: (index % cols) * (thumbWidth + gutter),
    top: Math.floor(index / cols) * (thumbHeight + gutter),
  })),
);
const montagePath = path.join(previewDir, "montage.png");
await sharp({
  create: {
    width: cols * thumbWidth + (cols - 1) * gutter,
    height: rows * thumbHeight + (rows - 1) * gutter,
    channels: 4,
    background: colors.soft,
  },
})
  .composite(composites)
  .png()
  .toFile(montagePath);

const manifest = {
  pptxPath,
  previewDir,
  montagePath,
  layoutDir,
  screenshotDir,
  slideCount: presentation.slides.count,
  pdfPath: null,
  note: "PDF export was not attempted because the local artifact runtime reliably supports PPTX and PNG previews in this environment.",
};

await fs.writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(JSON.stringify(manifest, null, 2));
process.exit(0);

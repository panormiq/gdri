const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "tutorial.json");
const outputPath = path.join(__dirname, "tutorial.html");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return "";
  }
  const items = steps
    .map((step) => {
      const text = escapeHtml(step.text || "");
      const image = step.image
        ? `<img src="${escapeHtml(step.image)}" alt="">`
        : "";
      return `<li>${text}${image}</li>`;
    })
    .join("");
  return `<ol class="steps">${items}</ol>`;
}

function renderSections(sections) {
  return sections
    .map((section, index) => {
      const id = escapeHtml(section.id || `section-${index + 1}`);
      const title = escapeHtml(section.title || "Section");
      const intro = section.intro ? `<p>${escapeHtml(section.intro)}</p>` : "";
      const steps = renderSteps(section.steps);
      const openAttr = index === 0 ? " open" : "";
      return `
        <details class="accordion" id="${id}"${openAttr}>
          <summary>${title}</summary>
          <div class="content">
            ${intro}
            ${steps}
          </div>
        </details>
      `;
    })
    .join("");
}

function buildHtml(data) {
  const title = escapeHtml(data.title || "Tutoriel");
  const intro = data.intro ? `<p class="intro">${escapeHtml(data.intro)}</p>` : "";
  const logo = data.logo
    ? `<img class="logo" src="${escapeHtml(data.logo)}" alt="${title}">`
    : "";
  const sections = renderSections(data.sections || []);

  const workflowHtml = `
      <section class="tab-panel" id="tab-workflow">
        <div class="workflow-area">
          <div class="workflow-canvas">
            <div class="zone green" style="left: 30%; top: 8%; width: 60%; height: 22%;">
              <div class="zone-label">Bureau Dedie</div>
            </div>
            <div class="zone blue" style="left: 2%; top: 42%; width: 22%; height: 28%;">
              <div class="zone-label">Entree</div>
            </div>
            <div class="zone green" style="left: 25%; top: 32%; width: 16%; height: 56%;">
              <div class="zone-label">Bureau Dedie</div>
            </div>
            <div class="zone purple" style="left: 40%; top: 36%; width: 42%; height: 30%;">
              <div class="zone-label">Pole Medical</div>
            </div>
            <div class="zone green" style="left: 82%; top: 36%; width: 16%; height: 30%;">
              <div class="zone-label">Bureau Dedie</div>
            </div>

            <svg class="workflow-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#1f2933"></path>
                </marker>
              </defs>
              <line x1="10" y1="55" x2="20" y2="55" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
              <line x1="32" y1="55" x2="40" y2="55" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
              <line x1="60" y1="55" x2="70" y2="55" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
              <line x1="72" y1="55" x2="82" y2="55" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
              <line x1="52" y1="26" x2="70" y2="26" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
              <line x1="34" y1="26" x2="34" y2="44" stroke="#1f2933" stroke-width="0.3" marker-end="url(#arrow)"></line>
            </svg>

            <button class="node rect" data-brick="protocole-reprise" data-title="Protocole de Reprise de Candidature" style="--x: 36%; --y: 18%;">Protocole de Reprise de Candidature</button>
            <button class="node pill light" data-brick="reprise-candidature" data-title="Reprise Candidature" style="--x: 34%; --y: 30%;">Reprise Candidature</button>
            <button class="node rect" data-brick="mise-en-attente" data-title="Protocole de Mise en Attente de Candidature" style="--x: 63%; --y: 18%;">Protocole de Mise en Attente de Candidature</button>
            <button class="node pill light" data-brick="candidature-attente" data-title="Candidature en Attente" style="--x: 82%; --y: 18%;">Candidature en Attente</button>

            <button class="node rect" data-brick="qr-codes" data-title="QR Codes" style="--x: 10%; --y: 55%;">QR Codes</button>
            <button class="node rect" data-brick="questionnaire-admission" data-title="Questionnaire d'Admission QMBI" style="--x: 20%; --y: 55%;">Questionnaire d'Admission QMBI</button>
            <button class="node doc" data-brick="questionnaire-complementaire" data-title="Questionnaire Complementaire" style="--x: 26%; --y: 38%;">Questionnaire Complementaire</button>
            <button class="node rect light" data-brick="demande-information" data-title="Demande d'Information Complementaire" style="--x: 32%; --y: 44%;">Demande d'Information Complementaire</button>

            <button class="node diamond" data-brick="dossier-administratif" data-title="Le Dossier Administratif Est Valide?" style="--x: 34%; --y: 55%;"><span>Le Dossier Administratif Est Valide?</span></button>
            <button class="node pill" data-brick="regles-validation-admin" data-title="Regles de Validation" style="--x: 42%; --y: 48%;">Regles de Validation</button>
            <button class="node rect" data-brick="protocole-refus" data-title="Protocole de refus de Candidature" style="--x: 36%; --y: 78%;">Protocole de refus de Candidature</button>
            <button class="node pill light" data-brick="candidature-refusee" data-title="Candidature Refusee" style="--x: 36%; --y: 90%;">Candidature Refusee</button>

            <button class="node diamond" data-brick="besoin-info" data-title="Besoin d'Information Complementaire?" style="--x: 50%; --y: 55%;"><span>Besoin d'Information Complementaire?</span></button>
            <button class="node diamond" data-brick="dossier-medical" data-title="Le Dossier Medical Est Valide?" style="--x: 60%; --y: 55%;"><span>Le Dossier Medical Est Valide?</span></button>
            <button class="node rect" data-brick="convocation-visite" data-title="Convocation a la Visite Medicale" style="--x: 70%; --y: 55%;">Convocation a la Visite Medicale</button>
            <button class="node diamond" data-brick="aptitude-candidat" data-title="Aptitude du Candidat" style="--x: 80%; --y: 55%;"><span>Aptitude du Candidat</span></button>

            <button class="node rect" data-brick="validation-candidature" data-title="Protocole de Validation de Candidature" style="--x: 88%; --y: 55%;">Protocole de Validation de Candidature</button>
            <button class="node pill light" data-brick="candidature-validee" data-title="Candidature Validee" style="--x: 94%; --y: 55%;">Candidature Validee</button>
          </div>

          <div class="brick-panel">
            <h3 id="brick-title">Brique selectionnee</h3>
            <div id="brick-content" class="brick-note">Cliquez sur une brique dans le schema pour afficher son JSON.</div>
          </div>
        </div>
      </section>
  `;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="./tutorial.css">
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <div class="hero-header">
          ${logo}
          <h1>${title}</h1>
        </div>
        ${intro}
      </header>

      <nav class="tabs">
        <button class="tab-button active" data-tab="basic">Basic / Parametrage</button>
        <button class="tab-button" data-tab="workflow">Workflow</button>
      </nav>

      <section class="tab-panel active" id="tab-basic">
        <section class="accordions">
          ${sections}
        </section>
      </section>

      ${workflowHtml}
    </main>
    <script>
      const tabs = document.querySelectorAll(".tab-button");
      const panels = document.querySelectorAll(".tab-panel");
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          tabs.forEach((btn) => btn.classList.remove("active"));
          panels.forEach((panel) => panel.classList.remove("active"));
          tab.classList.add("active");
          document.getElementById(\`tab-\${tab.dataset.tab}\`).classList.add("active");
        });
      });

      const brickTitle = document.getElementById("brick-title");
      const brickContent = document.getElementById("brick-content");
      const brickButtons = document.querySelectorAll("[data-brick]");

      function renderBrick(data, fallbackName) {
        const name = data.name || fallbackName;
        const description = data.description ? \`<p>\${data.description}</p>\` : "";
        const items = Array.isArray(data.bricks) ? data.bricks : [];
        const list = items.length
          ? \`<ul class="brick-list">\${items
              .map((item) => \`<li>\${item.name || item}</li>\`)
              .join("")}</ul>\`
          : "<p class=\\"brick-note\\">Aucune sous-brique definie.</p>";

        brickTitle.textContent = name;
        brickContent.innerHTML = \`\${description}\${list}\`;
      }

      function renderMissing(name) {
        brickTitle.textContent = name;
        brickContent.innerHTML =
          "<p class=\\"brick-note\\">Aucun dossier de brique trouve. Affichage du nom uniquement.</p>";
      }

      brickButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const brickId = button.dataset.brick;
          const brickName = button.dataset.title || brickId;
          const brickPath = \`./bricks/\${brickId}/brick.json\`;
          try {
            const response = await fetch(brickPath);
            if (!response.ok) {
              throw new Error("Not found");
            }
            const data = await response.json();
            renderBrick(data, brickName);
          } catch (error) {
            renderMissing(brickName);
          }
        });
      });
    </script>
  </body>
</html>
`;
}

const raw = fs.readFileSync(inputPath, "utf8");
const data = JSON.parse(raw);
const html = buildHtml(data);
fs.writeFileSync(outputPath, html, "utf8");

console.log(`Generated ${outputPath}`);

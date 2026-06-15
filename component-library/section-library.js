const htmlToText = (value = "") => {
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent || "";
};

const html = (strings, ...values) =>
  strings.reduce((out, part, index) => `${out}${part}${values[index] ?? ""}`, "");

function sectionShell(block, content) {
  const color = block.data?.bgColor || "bg0";
  return html`
    <article class="section-card ${color}">
      <header>
        <span>${block.type}</span>
        <h2>${block.title || block.type}</h2>
      </header>
      <div class="section-body">${content}</div>
    </article>
  `;
}

export function HeroSection(block) {
  const data = block.data || {};
  return sectionShell(
    block,
    html`
      ${data.logo ? `<img class="logo-preview" src="${data.logo}" alt="${data.logoAltText || "Campaign logo"}">` : ""}
      ${data.eyebrow ? `<p class="eyebrow">${htmlToText(data.eyebrow)}</p>` : ""}
      ${data.headline ? `<h3>${htmlToText(data.headline)}</h3>` : ""}
      ${data.desktopImage ? `<img class="media-preview" src="${data.desktopImage}" alt="${data.imageAltText || ""}">` : ""}
    `,
  );
}

export function FooterSection(block) {
  const data = block.data || {};
  return sectionShell(
    block,
    html`
      <div>${data.info || ""}</div>
      <div>${data.disclaimer || ""}</div>
    `,
  );
}

export function TextSection(block) {
  const data = block.data || {};
  return sectionShell(
    block,
    html`
      ${data.eyebrow ? `<p class="eyebrow">${htmlToText(data.eyebrow)}</p>` : ""}
      ${data.headline ? `<h3>${htmlToText(data.headline)}</h3>` : ""}
      ${data.text || data.description || ""}
    `,
  );
}

export function GallerySection(block) {
  const data = block.data || {};
  const images = data.images || data.items || [];
  return sectionShell(
    block,
    html`
      ${data.headline ? `<h3>${htmlToText(data.headline)}</h3>` : ""}
      <div class="gallery-grid">
        ${images
          .map((item) => {
            const src = item.image || item.url || item.src;
            return src ? `<img src="${src}" alt="${item.altText || item.imageAltText || ""}">` : "";
          })
          .join("")}
      </div>
    `,
  );
}

export function ListSection(block) {
  const data = block.data || {};
  const items = data.items || data.priorities || data.links || [];
  return sectionShell(
    block,
    html`
      ${data.eyebrow ? `<p class="eyebrow">${htmlToText(data.eyebrow)}</p>` : ""}
      ${data.headline ? `<h3>${htmlToText(data.headline)}</h3>` : ""}
      ${data.description ? `<div>${data.description}</div>` : ""}
      <ul>
        ${items
          .map((item) => `<li><strong>${htmlToText(item.title || item.headline || item.eyebrow || "")}</strong>${item.description || item.text || ""}</li>`)
          .join("")}
      </ul>
    `,
  );
}

export function QuoteSection(block) {
  const data = block.data || {};
  return sectionShell(
    block,
    html`
      ${data.image ? `<img class="media-preview" src="${data.image}" alt="${data.imageAltText || ""}">` : ""}
      <blockquote>${data.text || data.quote || ""}</blockquote>
    `,
  );
}

export function EmbedSection(block) {
  return sectionShell(block, `<pre>${(block.data?.html || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
}

export function renderSection(block) {
  if (block.type === "HERO") return HeroSection(block);
  if (block.type === "FOOTER") return FooterSection(block);
  if (["BASIC_TEXT", "LONG_FORM", "INTRO", "CTA", "ANNOUNCEMENT", "DATA_DETAILS", "TESTIMONIALS", "LOGOS"].includes(block.type)) {
    return TextSection(block);
  }
  if (block.type === "DONATE") return "";
  if (["GALLERY", "HEADSHOTS", "PEOPLE_WITH_BIOS"].includes(block.type)) return GallerySection(block);
  if (["PRIORITIES_LIST", "PRIORITIES_GRID", "NEWS_PREVIEW", "BULLET_COLUMNS", "VOTING", "CARDS"].includes(block.type)) {
    return ListSection(block);
  }
  if (block.type === "QUOTE") return QuoteSection(block);
  if (["EMBED", "BLUESKY"].includes(block.type)) return EmbedSection(block);
  return sectionShell(block, `<pre>${JSON.stringify(block.data || {}, null, 2)}</pre>`);
}

export async function mountComponentLibrary(target) {
  const response = await fetch("/data/next-data.json");
  const nextData = await response.json();
  const site = nextData.props.pageProps.site;
  const template = Object.values(site.Pages).find((page) => page.slug === "template");
  const order = [
    ...(template.blockStructure.HERO || []),
    ...(template.blockStructure.CONTENT || []),
    ...(template.blockStructure.FOOTER || []),
  ];
  const blocks = order.map((id) => site.Blocks[id]).filter(Boolean);
  target.innerHTML = blocks.map(renderSection).join("");
}

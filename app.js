(() => {
  "use strict";

  // ---------- DOM ----------
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const pasteArea = document.getElementById("pasteArea");
  const pasteBtn = document.getElementById("pasteBtn");
  const exampleBtn = document.getElementById("exampleBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");
  const errorBox = document.getElementById("errorBox");
  const intake = document.getElementById("intake");
  const results = document.getElementById("results");
  const summaryStrip = document.getElementById("summaryStrip");
  const customSection = document.getElementById("customSection");
  const unverifiedSection = document.getElementById("unverifiedSection");
  const filesSection = document.getElementById("filesSection");
  const coreSection = document.getElementById("coreSection");
  const sourceNote = document.getElementById("sourceNote");

  let lastManifestText = "";

  // ---------- File reference extraction ----------
  const EXT_RE = /([\w][\w,\s\-.\/\\]{0,180}\.(?:safetensors|ckpt|pth|pt|onnx|gguf|sft))(?=["'\s,\]\}]|$)/gi;
  const EMBED_RE = /embedding:([^\s,"')]+)/gi;

  function basename(p) {
    return p.replace(/\\/g, "/").split("/").pop().trim();
  }

  function categorizeFile(contextStr) {
    const t = contextStr.toLowerCase();
    if (t.includes("lora")) return "LoRA";
    if (t.includes("checkpoint") || t.includes("ckpt")) return "Checkpoint";
    if (t.includes("controlnet") || t.includes("control_net")) return "ControlNet";
    if (t.includes("vae")) return "VAE";
    if (t.includes("upscale")) return "Upscale model";
    if (t.includes("clipvision") || t.includes("clip_vision")) return "CLIP vision";
    if (t.includes("clip")) return "CLIP / text encoder";
    if (t.includes("unet") || t.includes("diffusion_model") || t.includes("diffusionmodel")) return "UNET / diffusion model";
    if (t.includes("gligen")) return "GLIGEN";
    if (t.includes("style_model") || t.includes("stylemodel")) return "Style model";
    if (t.includes("hypernetwork")) return "Hypernetwork";
    if (t.includes("photomaker")) return "PhotoMaker";
    return "Other model file";
  }

  function scanString(str, nodeType, fieldName, sink) {
    if (typeof str !== "string" || str.length < 3 || str.length > 2000) return;
    let m;
    EXT_RE.lastIndex = 0;
    while ((m = EXT_RE.exec(str))) {
      const name = basename(m[1].trim());
      if (!name || name.length > 150) continue;
      sink.push({
        filename: name,
        category: categorizeFile(`${nodeType || ""} ${fieldName || ""}`),
        nodeType: nodeType || "(unknown node)",
        field: fieldName || null,
      });
    }
    EMBED_RE.lastIndex = 0;
    while ((m = EMBED_RE.exec(str))) {
      sink.push({
        filename: m[1],
        category: "Embedding / textual inversion",
        nodeType: nodeType || "(unknown node)",
        field: fieldName || null,
      });
    }
  }

  function walkValue(val, nodeType, fieldName, sink, depth) {
    if (depth > 6 || val === null || val === undefined) return;
    if (typeof val === "string") {
      scanString(val, nodeType, fieldName, sink);
    } else if (Array.isArray(val)) {
      val.forEach((v) => walkValue(v, nodeType, fieldName, sink, depth + 1));
    } else if (typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        walkValue(v, nodeType, k, sink, depth + 1);
      }
    }
  }

  function findFileReferences(nodes) {
    const found = [];
    for (const n of nodes) {
      if (n.widgets_values !== undefined) walkValue(n.widgets_values, n.type, null, found, 0);
      if (n.inputs) walkValue(n.inputs, n.type, null, found, 0);
    }
    const seen = new Set();
    const deduped = [];
    for (const f of found) {
      const key = `${f.filename}::${f.nodeType}::${f.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(f);
    }
    return deduped;
  }

  // ---------- Node extraction & classification ----------
  function extractNodes(input) {
    let json = input;
    if (json && !Array.isArray(json.nodes) && json.workflow && Array.isArray(json.workflow.nodes)) {
      json = json.workflow;
    }

    if (Array.isArray(json.nodes)) {
      return {
        format: "ui",
        nodes: json.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title || (n.properties && n.properties["Node name for S&R"]) || null,
          properties: n.properties || {},
          widgets_values: n.widgets_values,
        })),
      };
    }

    const keys = Object.keys(json || {});
    const looksLikeApi =
      keys.length > 0 &&
      keys.every((k) => json[k] && typeof json[k] === "object" && typeof json[k].class_type === "string");

    if (looksLikeApi) {
      return {
        format: "api",
        nodes: keys.map((k) => ({
          id: k,
          type: json[k].class_type,
          title: (json[k]._meta && json[k]._meta.title) || null,
          properties: {},
          inputs: json[k].inputs || {},
        })),
      };
    }

    return { format: "unknown", nodes: [] };
  }

  function classifyNodes(nodes) {
    const byType = new Map();
    for (const n of nodes) {
      if (!n.type) continue;
      const existing = byType.get(n.type);
      if (existing) {
        existing.count++;
        continue;
      }
      const props = n.properties || {};
      let status, pkg = null, ver = null, detection;
      if (props.cnr_id) {
        detection = "metadata";
        if (/comfy.*core/i.test(props.cnr_id)) {
          status = "core";
        } else {
          status = "custom";
          pkg = props.cnr_id;
          ver = props.ver || null;
        }
      } else {
        detection = "heuristic";
        status = CORE_NODE_TYPES.has(n.type) ? "core" : "unverified";
      }
      byType.set(n.type, { type: n.type, count: 1, status, pkg, ver, detection });
    }
    return byType;
  }

  // ---------- Rendering ----------
  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function stamp(label, tone) {
    const s = el("span", `stamp stamp--${tone}`, label);
    return s;
  }

  function searchLink(query, href) {
    const a = el("a", "search-link", "search ↗");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = `Search for "${query}"`;
    return a;
  }

  function googleSearchLink(query) {
    return searchLink(query, `https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }

  function githubSearchLink(query) {
    return searchLink(query, `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`);
  }

  function renderError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    results.hidden = true;
  }

  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  function render(nodes, format) {
    const byType = classifyNodes(nodes);
    const entries = [...byType.values()];
    const core = entries.filter((e) => e.status === "core");
    const custom = entries.filter((e) => e.status === "custom");
    const unverified = entries.filter((e) => e.status === "unverified");
    const files = findFileReferences(nodes);

    // Summary strip
    summaryStrip.innerHTML = "";
    const stats = [
      [String(nodes.length), "node instances"],
      [String(entries.length), "unique node types"],
      [String(custom.length + unverified.length), "to double-check"],
      [String(files.length), "file references"],
    ];
    for (const [num, label] of stats) {
      const cell = el("div", "stat");
      cell.appendChild(el("div", "stat__num", num));
      cell.appendChild(el("div", "stat__label", label));
      summaryStrip.appendChild(cell);
    }

    sourceNote.textContent =
      format === "ui"
        ? "Read as a ComfyUI workflow export (full graph, widgets_values)."
        : "Read as an API / prompt export (class_type + inputs). Field names are shown where available.";

    // Custom packages (declared via workflow metadata)
    customSection.innerHTML = "";
    if (custom.length) {
      customSection.appendChild(el("h2", "section__title", "Install these custom node packs"));
      customSection.appendChild(
        el("p", "section__hint", "Declared directly in the workflow's saved metadata — highest confidence.")
      );
      const byPkg = new Map();
      for (const c of custom) {
        if (!byPkg.has(c.pkg)) byPkg.set(c.pkg, []);
        byPkg.get(c.pkg).push(c);
      }
      for (const [pkg, list] of byPkg) {
        const card = el("div", "card");
        const head = el("div", "card__head");
        head.appendChild(stamp("custom pack", "amber"));
        const ver = list.find((x) => x.ver)?.ver;
        head.appendChild(el("span", "card__title", pkg + (ver ? `  ·  v${ver}` : "")));
        head.appendChild(githubSearchLink(pkg));
        card.appendChild(head);
        const ul = el("ul", "card__list");
        for (const item of list) {
          ul.appendChild(el("li", null, `${item.type}${item.count > 1 ? `  ×${item.count}` : ""}`));
        }
        card.appendChild(ul);
        customSection.appendChild(card);
      }
    }
    customSection.hidden = custom.length === 0;

    // Unverified (no metadata, not in known core list)
    unverifiedSection.innerHTML = "";
    if (unverified.length) {
      unverifiedSection.appendChild(el("h2", "section__title", "Unverified — check these by hand"));
      unverifiedSection.appendChild(
        el(
          "p",
          "section__hint",
          "Not tagged with a source, and not in this checker's bundled core-node list. Could be custom, or just a node newer than that list. Search each name in ComfyUI Manager to confirm."
        )
      );
      const card = el("div", "card");
      const ul = el("ul", "card__list");
      for (const item of unverified.sort((a, b) => a.type.localeCompare(b.type))) {
        const li = el("li", null, `${item.type}${item.count > 1 ? `  ×${item.count}` : ""}  `);
        li.appendChild(stamp("unverified", "red"));
        li.appendChild(googleSearchLink(`${item.type} ComfyUI custom node`));
        ul.appendChild(li);
      }
      card.appendChild(ul);
      unverifiedSection.appendChild(card);
    }
    unverifiedSection.hidden = unverified.length === 0;

    // Model files
    filesSection.innerHTML = "";
    if (files.length) {
      filesSection.appendChild(el("h2", "section__title", "Model files referenced"));
      filesSection.appendChild(
        el("p", "section__hint", "Filenames found in the workflow's loader widgets and inputs — checkpoints, LoRAs, VAEs, and similar.")
      );
      const byCat = new Map();
      for (const f of files) {
        if (!byCat.has(f.category)) byCat.set(f.category, []);
        byCat.get(f.category).push(f);
      }
      const order = ["Checkpoint", "LoRA", "VAE", "ControlNet", "Upscale model", "CLIP / text encoder",
        "CLIP vision", "UNET / diffusion model", "Embedding / textual inversion", "Hypernetwork",
        "Style model", "GLIGEN", "PhotoMaker", "Other model file"];
      const cats = [...byCat.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      for (const cat of cats) {
        const card = el("div", "card");
        const head = el("div", "card__head");
        head.appendChild(stamp(cat, "teal"));
        card.appendChild(head);
        const ul = el("ul", "card__list card__list--files");
        for (const f of byCat.get(cat)) {
          const li = el("li");
          li.appendChild(el("span", "filename", f.filename));
          const ctx = el("span", "filename__ctx", f.field ? `${f.nodeType} · ${f.field}` : f.nodeType);
          li.appendChild(ctx);
          ul.appendChild(li);
        }
        card.appendChild(ul);
        filesSection.appendChild(card);
      }
    }
    filesSection.hidden = files.length === 0;

    // Core (collapsed, low priority)
    coreSection.innerHTML = "";
    if (core.length) {
      const details = el("details", "details");
      const summary = el("summary", null, `Bundled with ComfyUI (${core.length} node type${core.length === 1 ? "" : "s"}, nothing to install)`);
      details.appendChild(summary);
      const p = el("p", "section__hint", core.map((c) => c.type).sort().join(", "));
      details.appendChild(p);
      coreSection.appendChild(details);
    }
    coreSection.hidden = core.length === 0;

    // Build copyable manifest text
    lastManifestText = buildManifestText({ custom, unverified, files, nodeCount: nodes.length, typeCount: entries.length });

    results.hidden = false;
    errorBox.hidden = true;
  }

  function buildManifestText({ custom, unverified, files, nodeCount, typeCount }) {
    const lines = [];
    lines.push("ComfyUI workflow manifest");
    lines.push(`${nodeCount} node instances, ${typeCount} unique node types`);
    lines.push("");
    if (custom.length) {
      lines.push("Custom node packs to install:");
      const byPkg = new Map();
      for (const c of custom) {
        if (!byPkg.has(c.pkg)) byPkg.set(c.pkg, []);
        byPkg.get(c.pkg).push(c);
      }
      for (const [pkg, list] of byPkg) {
        const ver = list.find((x) => x.ver)?.ver;
        lines.push(`  [ ] ${pkg}${ver ? ` (v${ver})` : ""} — ${list.map((l) => l.type).join(", ")}`);
      }
      lines.push("");
    }
    if (unverified.length) {
      lines.push("Unverified node types (check manually):");
      for (const u of unverified.sort((a, b) => a.type.localeCompare(b.type))) {
        lines.push(`  [ ] ${u.type}`);
      }
      lines.push("");
    }
    if (files.length) {
      lines.push("Model files referenced:");
      for (const f of files) {
        lines.push(`  [ ] ${f.filename}  (${f.category})`);
      }
      lines.push("");
    }
    if (!custom.length && !unverified.length && !files.length) {
      lines.push("Only core ComfyUI nodes and no model files were detected.");
    }
    return lines.join("\n");
  }

  // ---------- Ingest ----------
  function ingest(text) {
    clearError();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      renderError("That file isn't valid JSON — double check you exported the workflow (not a screenshot or PNG) and try again.");
      return;
    }
    const { format, nodes } = extractNodes(json);
    if (format === "unknown" || nodes.length === 0) {
      renderError(
        "This JSON doesn't look like a ComfyUI workflow or API/prompt export — expected a top-level \"nodes\" array or an object of {id: {class_type, inputs}}."
      );
      return;
    }
    render(nodes, format);
  }

  function readFile(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      renderError("That doesn't look like a .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result));
    reader.onerror = () => renderError("Couldn't read that file.");
    reader.readAsText(file);
  }

  // ---------- Wiring ----------
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", (e) => readFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    readFile(file);
  });

  pasteBtn.addEventListener("click", () => {
    const text = pasteArea.value.trim();
    if (!text) { renderError("Paste some workflow JSON first."); return; }
    ingest(text);
  });

  resetBtn.addEventListener("click", () => {
    results.hidden = true;
    errorBox.hidden = true;
    pasteArea.value = "";
    fileInput.value = "";
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(lastManifestText);
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy manifest as checklist"), 1500);
    } catch {
      renderError("Couldn't copy — your browser may be blocking clipboard access.");
    }
  });

  exampleBtn.addEventListener("click", () => {
    ingest(JSON.stringify(EXAMPLE_WORKFLOW));
  });

  // A small embedded example so the tool can be tried without a real file.
  const EXAMPLE_WORKFLOW = {
    nodes: [
      { id: 1, type: "CheckpointLoaderSimple", properties: {}, widgets_values: ["sd_xl_base_1.0.safetensors"] },
      { id: 2, type: "CLIPTextEncode", properties: {}, widgets_values: ["a lighthouse at dusk, embedding:easynegative"] },
      { id: 3, type: "LoraLoader", properties: {}, widgets_values: ["add_detail_xl.safetensors", 0.8, 0.8] },
      { id: 4, type: "KSampler", properties: {}, widgets_values: [156, "randomize", 24, 6.5, "dpmpp_2m", "karras", 1] },
      { id: 5, type: "VAEDecode", properties: {}, widgets_values: [] },
      { id: 6, type: "SaveImage", properties: {}, widgets_values: ["ComfyUI"] },
      {
        id: 7,
        type: "ImpactSimpleDetectorSEGS",
        properties: { cnr_id: "comfyui-impact-pack", ver: "8.7.2", "Node name for S&R": "ImpactSimpleDetectorSEGS" },
        widgets_values: [0.5, 3, 10, 0, 0.5],
      },
      { id: 8, type: "SomeBrandNewSamplerNode", properties: {}, widgets_values: [] },
    ],
  };
})();

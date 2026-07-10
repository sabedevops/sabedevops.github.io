/* ============================================================
   typewriter.js
   - term / paper mode toggle (persisted)
   - margin-bell easter egg: type a long line, hit the bell,
     and return the carriage like a real typist would.
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------------- mode toggle ---------------- */
  function setMode(mode) {
    root.setAttribute("data-mode", mode);
    try { localStorage.setItem("teletype-mode", mode); } catch (e) {}
  }
  function toggleMode() {
    setMode(root.getAttribute("data-mode") === "paper" ? "term" : "paper");
  }

  var toggleBtn = document.getElementById("mode-toggle");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleMode);

  /* ---------------- tiny web-audio foley ---------------- */
  var actx = null;
  function audio() {
    if (actx === null) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = false; }
    }
    if (actx && actx.state === "suspended") actx.resume();
    return actx || null;
  }
  function tone(freq, dur, type, gain, when) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (when || 0);
    var osc = a.createOscillator();
    var g = a.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function clack() {           // a key striking the platen
    var a = audio(); if (!a) return;
    tone(220 + Math.random() * 60, 0.03, "square", 0.018);
    tone(90, 0.05, "triangle", 0.02);
  }
  function bell() {            // the margin bell
    tone(1880, 0.5, "sine", 0.06);
    tone(2500, 0.45, "sine", 0.03, 0.005);
  }
  function carriageReturn() {  // zip + thunk
    tone(140, 0.14, "sawtooth", 0.03);
    tone(70, 0.12, "square", 0.05, 0.1);
  }

  /* ---------------- margin bell mechanism ---------------- */
  var MARGIN_BELL = 68;   // column where the bell rings
  var MARGIN_MAX  = 80;   // physical end of the platen

  var carriage = document.getElementById("carriage");
  var elLine   = document.getElementById("carriage-line");
  var elCursor = document.getElementById("carriage-cursor");
  var elBell   = document.getElementById("carriage-bell");
  var elStatus = document.getElementById("carriage-status");
  var reveal   = document.getElementById("typewriter-reveal");
  var sheet    = document.getElementById("paper-sheet");

  var line = "";
  var belled = false;
  var jammed = false;
  var unlocked = false;
  var idleTimer = null;

  function editable(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
           el.isContentEditable || el.id === "repl-input";
  }

  function showCarriage() {
    if (carriage) carriage.classList.add("show");
  }
  function hideCarriage() {
    if (carriage) carriage.classList.remove("show");
  }
  function resetLine(keepVisible) {
    line = ""; belled = false; jammed = false;
    if (carriage) carriage.classList.remove("jammed");
    if (elBell) elBell.classList.remove("ring");
    render();
    if (!keepVisible) hideCarriage();
  }
  function render() {
    if (!carriage) return;
    var col = Math.min(line.length, MARGIN_MAX);
    if (elCursor) elCursor.style.left = (col / MARGIN_MAX * 100) + "%";
    if (elLine) elLine.textContent = line.slice(-MARGIN_MAX);
    if (elStatus) {
      if (jammed) {
        elStatus.innerHTML = 'the keys jam against the margin — <span class="hot">press ⏎ to return the carriage</span>';
      } else if (belled) {
        elStatus.innerHTML = '<span class="hot">🔔 margin bell</span> — a good typist returns here (press ⏎)';
      } else {
        elStatus.textContent = "col " + col + " / " + MARGIN_MAX;
      }
    }
  }
  function bumpIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!jammed) resetLine(false);
    }, 4000);
  }

  function typewriterReveal() {
    if (!reveal || !sheet) return;
    unlocked = true;
    var text =
      "*ding*  ⏎\n\n" +
      "You returned the carriage at the bell —\n" +
      "the tell of someone who has actually\n" +
      "set a margin and typed to it.\n\n" +
      "  “The bell doesn't tell you to stop.\n" +
      "   It tells you the edge is near, so you\n" +
      "   can finish the word and return clean.”\n\n" +
      "-- sabedevops\n\n" +
      "[ margin-bell easter egg found ]";
    sheet.innerHTML = "";
    reveal.hidden = false;
    carriageReturn();
    var i = 0;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var pre = document.createElement("span");
    sheet.appendChild(pre);
    function step() {
      if (i <= text.length) {
        pre.textContent = text.slice(0, i);
        var ch = text[i - 1];
        if (ch && ch !== " " && ch !== "\n") clack();
        i++;
        setTimeout(step, reduce ? 0 : (text[i - 1] === "\n" ? 90 : 22));
      } else {
        var close = document.createElement("a");
        close.className = "sheet-close";
        close.textContent = "⏎  return to the terminal";
        close.href = "#";
        close.addEventListener("click", closeReveal);
        sheet.appendChild(close);
      }
    }
    if (reduce) { pre.textContent = text; step = null; }
    if (reduce) {
      var close = document.createElement("a");
      close.className = "sheet-close";
      close.textContent = "⏎  return to the terminal";
      close.href = "#";
      close.addEventListener("click", closeReveal);
      sheet.appendChild(close);
    } else {
      step();
    }
  }
  function closeReveal(e) {
    if (e) e.preventDefault();
    if (reveal) reveal.hidden = true;
    resetLine(false);
  }
  if (reveal) reveal.addEventListener("click", function (e) {
    if (e.target === reveal) closeReveal(e);
  });

  document.addEventListener("keydown", function (e) {
    if (simOpen || racerOpen) return;          // an app (typewriter / typeracer) owns the keyboard

    // global shortcut: backtick (`/~) toggles term/paper mode.
    // (A plain letter would collide with the "type a long line" egg.)
    if (!editable(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === "`" || e.key === "~") { e.preventDefault(); toggleMode(); return; }
      if (e.key === "Escape" && reveal && !reveal.hidden) { closeReveal(e); return; }
    }

    if (editable(e.target)) return;            // let inputs / the REPL do their thing
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (reveal && !reveal.hidden) {
      if (e.key === "Enter" || e.key === "Escape") closeReveal(e);
      return;
    }

    // Carriage return: reward if you returned after the bell
    if (e.key === "Enter") {
      if (belled || jammed) {
        e.preventDefault();
        if (carriage) {
          carriage.classList.remove("jammed");
          carriage.classList.add("returning");
          setTimeout(function () { carriage.classList.remove("returning"); }, 520);
        }
        typewriterReveal();
        resetLine(true);
        setTimeout(hideCarriage, 400);
      } else {
        resetLine(false);
      }
      return;
    }

    if (e.key === "Backspace") {
      if (line.length) {
        e.preventDefault();
        line = line.slice(0, -1);
        if (line.length < MARGIN_BELL) belled = false;
        if (line.length < MARGIN_MAX) { jammed = false; if (carriage) carriage.classList.remove("jammed"); }
        render();
        bumpIdle();
      }
      return;
    }

    // Only printable single characters advance the carriage
    if (e.key.length !== 1) return;

    line += e.key;
    if (line.length >= 8) showCarriage();
    clack();

    if (line.length === MARGIN_BELL && !belled) {
      belled = true;
      bell();
      if (elBell) { elBell.classList.remove("ring"); void elBell.offsetWidth; elBell.classList.add("ring"); }
    }
    if (line.length >= MARGIN_MAX) {
      // can't go further — the carriage jams
      line = line.slice(0, MARGIN_MAX);
      if (!jammed) {
        jammed = true;
        if (carriage) { carriage.classList.remove("jammed"); void carriage.offsetWidth; carriage.classList.add("jammed"); }
      }
    }
    render();
    bumpIdle();
  });

  /* ============================================================
     typewriter simulator — launched by the terminal `typewriter`
     command. A real-feeling manual typewriter: platen + paper,
     per-key clack, margin bell, carriage return + line feed,
     tab stops, a bicolour black/red ribbon, and save-to-.txt.
     ============================================================ */
  var simOpen = false;
  var MAX_COLS = 80, BELL_LEAD = 8;
  var simRoot = null, els = {}, twInput = null, twPrevMode = null;

  // settings (Wheelwriter-style)
  var leftMargin = 0, rightMargin = 80, ribbon = "black";
  var caps = false, autoReturn = false, bold = false;
  var align = "normal";        // 'normal' | 'center' | 'decimal' (a transient input mode)
  var underline = "off";       // 'off' | 'cont' | 'word'
  var alignBuf = [];           // buffered glyphs while centering / decimal-aligning
  var alignAnchor = 0;         // column the buffer aligns to (captured when you engage)
  var decPhase = "int";        // decimal sub-state: 'int' (fills left) | 'frac' (types forward)
  var tabStops = [];           // columns of user-set tab stops (no presets)

  // each printed line = { g: [ {c,color,ul,bold} ], left }  (chars sit at absolute columns)
  var docLines = [ newLineObj() ], simBelled = false;

  function newLineObj() { return { g: [], left: leftMargin }; }
  function repeat(s, n) { return n > 0 ? new Array(n + 1).join(s) : ""; }

  function escHtml(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;";
    });
  }

  function buildSim() {
    if (simRoot) return;
    simRoot = document.createElement("div");
    simRoot.id = "typewriter-sim";
    simRoot.setAttribute("role", "dialog");
    simRoot.setAttribute("aria-label", "Typewriter simulator");
    simRoot.innerHTML =
      '<div class="tw-stage">' +
        '<div class="tw-topbar">' +
          '<span class="tw-model">sabedevops // model&nbsp;T — typewriter</span>' +
          '<button class="tw-close" type="button" aria-label="Close typewriter">esc ✕</button>' +
        '</div>' +
        '<div class="tw-platen"><span class="tw-knob"></span><span class="tw-knob right"></span></div>' +
        '<div class="tw-paper"><div class="tw-lines"></div></div>' +
        '<div class="tw-panel">' +
          '<div class="tw-group">' +
            '<span class="tw-glabel">margins</span>' +
            '<button class="tw-key" data-marg="left" type="button">set&nbsp;L</button>' +
            '<button class="tw-key" data-marg="right" type="button">set&nbsp;R</button>' +
            '<button class="tw-key" data-marg="reset" type="button">clear</button>' +
          '</div>' +
          '<div class="tw-group">' +
            '<span class="tw-glabel">tabs</span>' +
            '<button class="tw-key" data-tab="set" type="button" title="Set a tab stop at the carriage">set&nbsp;tab</button>' +
            '<button class="tw-key" data-tab="clear" type="button" title="Clear the tab stop at the carriage">clear&nbsp;tab</button>' +
            '<button class="tw-key" data-tab="all" type="button" title="Clear all tab stops">clear&nbsp;all</button>' +
          '</div>' +
          '<div class="tw-group">' +
            '<span class="tw-glabel">modes</span>' +
            '<button class="tw-key tog" data-mode="autortn" type="button" title="Automatic carrier return + word wrap">auto&nbsp;rtn</button>' +
            '<button class="tw-key tog" data-mode="caps" type="button" title="Caps lock">caps</button>' +
            '<button class="tw-key tog" data-mode="center" type="button" title="Centre between margins">center</button>' +
            '<button class="tw-key tog" data-mode="decimal" type="button" title="Decimal-tab align">dec&nbsp;tab</button>' +
            '<button class="tw-key tog" data-mode="undln" type="button" title="Continuous underline">undln</button>' +
            '<button class="tw-key tog" data-mode="wundln" type="button" title="Word underline (skips spaces)">word&nbsp;undln</button>' +
            '<button class="tw-key tog" data-mode="bold" type="button" title="Bold (overstrike)">bold</button>' +
          '</div>' +
        '</div>' +
        '<div class="tw-deck">' +
          '<div class="tw-carriage" aria-hidden="true">' +
            '<div class="tw-ruler"></div>' +
            '<div class="tw-tabs"></div>' +
            '<div class="tw-bellmark">🔔</div>' +
            '<div class="tw-head"></div>' +
          '</div>' +
          '<div class="tw-status">' +
            '<span class="tw-col">col 0/' + MAX_COLS + '</span>' +
            '<span class="tw-margins">L0 R80</span>' +
            '<span class="tw-msg"></span>' +
          '</div>' +
          '<div class="tw-controls">' +
            '<span class="tw-ribbon" title="Ribbon colour">' +
              '<button class="tw-rib blk active" data-rib="black" type="button" aria-label="Black ribbon"></button>' +
              '<button class="tw-rib red" data-rib="red" type="button" aria-label="Red ribbon"></button>' +
            '</span>' +
            '<button class="tw-btn" data-act="return" type="button">⏎ return</button>' +
            '<button class="tw-btn" data-act="new" type="button">new sheet</button>' +
            '<button class="tw-btn" data-act="print" type="button">print</button>' +
            '<button class="tw-btn" data-act="save" type="button">save .txt</button>' +
          '</div>' +
        '</div>' +
        '<p class="tw-help">80-col platen · move the carriage, then <b>set&nbsp;L</b>/<b>set&nbsp;R</b> for margins and <b>set&nbsp;tab</b> for tab stops · ' +
          '<b>⏎</b> return · <b>tab</b> next stop · <b>⌘/ctrl+P</b> print · <b>esc</b> to leave</p>' +
      '</div>';

    // hidden input summons mobile keyboards and captures characters
    twInput = document.createElement("input");
    twInput.className = "tw-capture";
    twInput.setAttribute("aria-hidden", "true");
    twInput.autocapitalize = "off"; twInput.autocomplete = "off";
    twInput.autocorrect = "off"; twInput.spellcheck = false;
    simRoot.querySelector(".tw-stage").appendChild(twInput);

    document.body.appendChild(simRoot);

    els.lines   = simRoot.querySelector(".tw-lines");
    els.paper   = simRoot.querySelector(".tw-paper");
    els.bell    = simRoot.querySelector(".tw-bellmark");
    els.head    = simRoot.querySelector(".tw-head");
    els.tabs    = simRoot.querySelector(".tw-tabs");
    els.col     = simRoot.querySelector(".tw-col");
    els.margins = simRoot.querySelector(".tw-margins");
    els.msg     = simRoot.querySelector(".tw-msg");
    els.stage   = simRoot.querySelector(".tw-stage");

    simRoot.querySelector(".tw-close").addEventListener("click", closeSim);
    simRoot.addEventListener("mousedown", function (e) {
      if (e.target === simRoot) { closeSim(); return; }
      if (e.target.closest(".tw-btn,.tw-rib,.tw-close,.tw-key")) return;
      setTimeout(function () { twInput.focus({ preventScroll: true }); }, 0);
    });
    Array.prototype.forEach.call(simRoot.querySelectorAll(".tw-rib"), function (b) {
      b.addEventListener("click", function () { setRibbon(b.getAttribute("data-rib")); twInput.focus(); });
    });
    Array.prototype.forEach.call(simRoot.querySelectorAll(".tw-btn"), function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-act");
        if (act === "return") carriageReturnSim();
        else if (act === "new") newSheet();
        else if (act === "print") printSheet();
        else if (act === "save") saveSheet();
        twInput.focus();
      });
    });
    Array.prototype.forEach.call(simRoot.querySelectorAll("[data-marg]"), function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-marg");
        if (m === "left") setLeftMargin();
        else if (m === "right") setRightMargin();
        else resetMargins();
        twInput.focus();
      });
    });
    Array.prototype.forEach.call(simRoot.querySelectorAll("[data-tab]"), function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-tab");
        if (m === "set") setTab();
        else if (m === "clear") clearTab();
        else clearAllTabs();
        twInput.focus();
      });
    });
    Array.prototype.forEach.call(simRoot.querySelectorAll("[data-mode]"), function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-mode");
        if (m === "autortn") autoReturn = !autoReturn;
        else if (m === "caps") caps = !caps;
        else if (m === "bold") bold = !bold;
        else if (m === "center") { toggleCenter(); twInput.focus(); return; }
        else if (m === "decimal") { toggleDecimal(); twInput.focus(); return; }
        else if (m === "undln") underline = (underline === "cont" ? "off" : "cont");
        else if (m === "wundln") underline = (underline === "word" ? "off" : "word");
        updatePanel(); renderSim(); twInput.focus();
      });
    });
    updatePanel();

    twInput.addEventListener("keydown", onSimKey);
    twInput.addEventListener("beforeinput", onSimBeforeInput);
    twInput.addEventListener("input", function () { twInput.value = ""; });
  }

  function setRibbon(col) {
    ribbon = col;
    if (!simRoot) return;
    Array.prototype.forEach.call(simRoot.querySelectorAll(".tw-rib"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-rib") === col);
    });
  }
  function curLine() { return docLines[docLines.length - 1]; }

  // the line you're on adopts the current left margin; finished lines keep theirs
  function syncCurrent() { curLine().left = leftMargin; }

  // characters live at absolute columns, so a line just prints from its left margin
  function lineLayout(ln) {
    return { indent: ln.left, col: ln.left + ln.g.length, avail: Math.max(1, rightMargin - ln.left) };
  }

  function centerColFor(ln) { return ln.left + Math.floor((rightMargin - ln.left) / 2); }

  // the print-head column, accounting for a backward-moving align buffer
  function headCol() {
    var ln = curLine();
    if (align === "center") return Math.max(ln.left, alignAnchor - Math.floor(alignBuf.length / 2));
    if (align === "decimal" && decPhase === "int") return Math.max(ln.left, alignAnchor - alignBuf.length);
    return ln.left + ln.g.length;
  }

  function nudge() { if (els.stage) { els.stage.classList.remove("nudge"); void els.stage.offsetWidth; els.stage.classList.add("nudge"); } }
  function ringBell() { if (els.bell) { els.bell.classList.remove("ring"); void els.bell.offsetWidth; els.bell.classList.add("ring"); } }
  function paperReturnAnim() { if (els.paper) { els.paper.classList.remove("returning"); void els.paper.offsetWidth; els.paper.classList.add("returning"); } }

  function setActive(name, on) {
    var b = simRoot && simRoot.querySelector('[data-mode="' + name + '"]');
    if (b) b.classList.toggle("active", !!on);
  }
  function updatePanel() {
    if (!simRoot) return;
    setActive("autortn", autoReturn);
    setActive("caps", caps);
    setActive("bold", bold);
    setActive("center", align === "center");
    setActive("decimal", align === "decimal");
    setActive("undln", underline === "cont");
    setActive("wundln", underline === "word");
    if (els.margins) els.margins.textContent = "L" + leftMargin + " R" + rightMargin;
  }

  function setLeftMargin() {
    syncCurrent();
    var col = lineLayout(curLine()).col;
    leftMargin = Math.max(0, Math.min(col, rightMargin - 1));
    syncCurrent(); updatePanel(); renderSim();
  }
  function setRightMargin() {
    syncCurrent();
    var col = lineLayout(curLine()).col;
    rightMargin = Math.min(MAX_COLS, Math.max(leftMargin + 1, col));
    syncCurrent(); updatePanel(); renderSim();
  }
  function resetMargins() {
    leftMargin = 0; rightMargin = MAX_COLS;
    syncCurrent(); updatePanel(); renderSim();
  }

  // build coloured / underlined / bold runs for a line's glyphs
  function glyphRuns(g, forPrint) {
    var html = "", run = "", key = null;
    function keyOf(x) { return (x.color === "red" ? "r" : "b") + (x.ul ? "u" : "") + (x.bold ? "o" : ""); }
    function flush() {
      if (run === "") return;
      var red = key.charAt(0) === "r", ul = key.indexOf("u") >= 0, bd = key.indexOf("o") >= 0;
      if (forPrint) {
        var cls = [];
        if (red) cls.push("r"); if (ul) cls.push("u"); if (bd) cls.push("o");
        html += cls.length ? '<span class="' + cls.join(" ") + '">' + escHtml(run) + "</span>" : escHtml(run);
      } else {
        var c = "ink-" + (red ? "red" : "blk");
        if (ul) c += " ul"; if (bd) c += " bold";
        html += '<span class="' + c + '">' + escHtml(run) + "</span>";
      }
      run = "";
    }
    for (var i = 0; i < g.length; i++) {
      var k = keyOf(g[i]);
      if (k !== key) { flush(); key = k; }
      run += g[i].c;
    }
    flush();
    return html;
  }

  function renderSim() {
    syncCurrent();
    var lastIdx = docLines.length - 1;
    var html =
      '<div class="tw-guide l" style="left:' + leftMargin + 'ch"></div>' +
      '<div class="tw-guide r" style="left:' + rightMargin + 'ch"></div>';
    for (var li = 0; li < docLines.length; li++) {
      var ln = docLines[li];
      html += '<div class="tw-line">';
      if (ln.left > 0) html += '<span class="tw-indent">' + escHtml(repeat(" ", ln.left)) + '</span>';
      html += glyphRuns(ln.g, false);
      if (li === lastIdx) html += bufferPreview(ln);
      html += "</div>";
    }
    els.lines.innerHTML = html;

    var cur = curLine(), col = headCol();
    els.col.textContent = "col " + col + "/" + MAX_COLS;
    if (els.margins) els.margins.textContent = "L" + leftMargin + " R" + rightMargin;
    if (els.head) els.head.style.left = (Math.min(col, MAX_COLS) / MAX_COLS * 100) + "%";
    if (els.tabs) {
      var tm = "";
      for (var t = 0; t < tabStops.length; t++) tm += '<i style="left:' + (tabStops[t] / MAX_COLS * 100) + '%"></i>';
      els.tabs.innerHTML = tm;
    }
    if (els.bell) {
      els.bell.style.left = (Math.max(0, rightMargin - BELL_LEAD) / MAX_COLS * 100) + "%";
      els.bell.classList.toggle("hot", simBelled);
    }
    els.msg.textContent =
      align === "center"  ? "centering — ⏎ prints & keeps centering · center to stop" :
      align === "decimal" ? (decPhase === "frac"
        ? "decimal — fraction types forward · ⏎ keeps dec-tab for the next figure"
        : "decimal — digits fill left · type . for the point, or ⏎ for the next figure") :
      (cur.g.length >= lineLayout(cur).avail ? "margin — press ⏎" :
        (simBelled ? (autoReturn ? "bell — space to auto-return" : "bell — finish the word") : ""));

    els.paper.scrollTop = els.paper.scrollHeight;
    els.paper.scrollLeft = els.paper.scrollWidth;
  }

  // the carriage caret only — while centering/aligning nothing is printed yet;
  // the carriage just steps backward until you commit (like a real machine)
  function bufferPreview(ln) {
    var pad = headCol() - (ln.left + ln.g.length);
    var h = "";
    if (pad > 0) h += '<span class="tw-indent">' + escHtml(repeat(" ", pad)) + '</span>';
    return h + '<span class="tw-caret"></span>';
  }

  function makeGlyph(c) {
    var ch = caps ? c.toUpperCase() : c;
    var ul = underline === "cont" ? true : (underline === "word" ? (ch !== " ") : false);
    return { c: ch, color: ribbon, ul: ul, bold: bold };
  }
  function padTo(ln, col) { while (ln.g.length < col - ln.left) ln.g.push({ c: " ", color: ribbon, ul: false, bold: false }); }

  function typeCharSim(c) {
    syncCurrent();
    if (align === "center") { bufferChar(c); return; }
    if (align === "decimal") { decimalChar(c); return; }

    // Wheelwriter automatic return: once the bell has rung, the next space
    // becomes the carriage return (the space is consumed, not printed).
    if (autoReturn && simBelled && c === " ") { carriageReturnSim(); return; }
    appendChar(c);
  }

  // print a character forward at the carriage (normal typing + fractions)
  function appendChar(c) {
    var ln = curLine(), lay = lineLayout(ln);
    if (ln.g.length >= lay.avail) { tone(120, 0.05, "square", 0.03); nudge(); return; }
    ln.g.push(makeGlyph(c));
    clack();
    var bellAt = Math.max(1, lay.avail - BELL_LEAD);
    if (ln.g.length === bellAt && !simBelled) { simBelled = true; bell(); ringBell(); }
    renderSim();
  }

  // centering buffer: the carriage steps backward (see headCol)
  function bufferChar(c) {
    var ln = curLine();
    if (alignBuf.length >= rightMargin - ln.left) { tone(120, 0.05, "square", 0.03); nudge(); return; }
    alignBuf.push(makeGlyph(c));
    clack(); renderSim();
  }

  // decimal tab: digits fill leftward until the point, then the fraction types forward
  function decimalChar(c) {
    if (decPhase === "frac") { appendChar(c); return; }
    if (c === ".") { setDecimalPoint(); return; }
    var ln = curLine();
    if (alignBuf.length >= alignAnchor - ln.left) { tone(120, 0.05, "square", 0.03); nudge(); return; }
    alignBuf.push(makeGlyph(c));
    clack(); renderSim();
  }
  // place the buffer so its left edge sits at `start`. Carriage-fill trailing
  // spaces between `start` and the anchor are removed first, so the FIRST figure
  // (where you spaced/tabbed the carriage over) lines up with later figures typed
  // on otherwise-empty lines.
  function placeAt(ln, start) {
    while (ln.g.length > start - ln.left && ln.g[ln.g.length - 1].c === " ") ln.g.pop();
    padTo(ln, start);
    for (var i = 0; i < alignBuf.length; i++) ln.g.push(alignBuf[i]);
    alignBuf = [];
  }
  function writeIntBuffer(ln)    { placeAt(ln, Math.max(ln.left, alignAnchor - alignBuf.length)); }
  function writeCenterBuffer(ln) { placeAt(ln, Math.max(ln.left, alignAnchor - Math.floor(alignBuf.length / 2))); }

  function setDecimalPoint() {          // commit the integer, print the point, type the fraction forward
    var ln = curLine();
    writeIntBuffer(ln);
    ln.g.push(makeGlyph("."));
    clack();
    decPhase = "frac"; renderSim();
  }

  // both centering and decimal are persistent modes: they stay on until you
  // toggle them off; a carriage return commits the line and keeps the mode.
  function exitCenter() {
    if (alignBuf.length) writeCenterBuffer(curLine());
    align = "normal"; alignBuf = [];
  }
  function exitDecimal() {
    if (decPhase === "int" && alignBuf.length) writeIntBuffer(curLine());
    align = "normal"; decPhase = "int"; alignBuf = [];
  }
  // flush pending buffered text onto the paper without a mode change (for tab / save / print)
  function commitBuffer() {
    if (align === "center" && alignBuf.length) writeCenterBuffer(curLine());
    else if (align === "decimal" && decPhase === "int" && alignBuf.length) writeIntBuffer(curLine());
  }

  function toggleCenter() {
    if (align === "center") { exitCenter(); updatePanel(); renderSim(); return; }
    if (align === "decimal") exitDecimal();
    align = "center"; alignBuf = []; alignAnchor = centerColFor(curLine());
    updatePanel(); renderSim();
  }
  function toggleDecimal() {
    if (align === "decimal") { exitDecimal(); updatePanel(); renderSim(); return; }
    if (align === "center") exitCenter();
    align = "decimal"; decPhase = "int"; alignBuf = [];
    alignAnchor = lineLayout(curLine()).col;   // the decimal tab column = current carriage
    updatePanel(); renderSim();
  }

  // tab stops — you set them yourself; there are no presets
  function setTab() {
    commitBuffer(); syncCurrent();
    var col = lineLayout(curLine()).col;
    if (tabStops.indexOf(col) < 0) { tabStops.push(col); tabStops.sort(function (a, b) { return a - b; }); }
    renderSim();
  }
  function clearTab() {
    commitBuffer(); syncCurrent();
    var i = tabStops.indexOf(lineLayout(curLine()).col);
    if (i >= 0) tabStops.splice(i, 1);
    renderSim();
  }
  function clearAllTabs() { tabStops = []; renderSim(); }

  function doReturn() {
    syncCurrent();
    docLines.push(newLineObj());
    simBelled = false;
    carriageReturn();
    paperReturnAnim();
  }
  function carriageReturnSim() {
    if (align === "decimal") {
      if (decPhase === "int" && alignBuf.length) writeIntBuffer(curLine());
      doReturn();
      decPhase = "int"; alignBuf = [];        // dec-tab stays engaged for the next figure
      renderSim();
      return;
    }
    if (align === "center") {
      if (alignBuf.length) writeCenterBuffer(curLine());
      doReturn();
      alignBuf = []; alignAnchor = centerColFor(curLine());   // centring stays on, re-armed
      renderSim();
      return;
    }
    doReturn(); renderSim();
  }

  function backspaceSim() {
    syncCurrent();
    if ((align === "center" || align === "decimal") && alignBuf.length) {
      alignBuf.pop(); tone(180, 0.03, "square", 0.012); renderSim(); return;
    }
    var ln = curLine();
    if (ln.g.length) { ln.g.pop(); tone(180, 0.03, "square", 0.012); }
    else if (docLines.length > 1) { docLines.pop(); }
    syncCurrent();
    var lay = lineLayout(curLine());
    simBelled = curLine().g.length >= Math.max(1, lay.avail - BELL_LEAD);
    renderSim();
  }

  function tabSim() {
    commitBuffer();
    syncCurrent();
    var ln = curLine(), col = lineLayout(ln).col, next = -1;
    for (var i = 0; i < tabStops.length; i++) { if (tabStops[i] > col) { next = tabStops[i]; break; } }
    if (next < 0) { tone(120, 0.05, "square", 0.03); nudge(); return; }  // no tab stop set here
    if (next > rightMargin) next = rightMargin;
    padTo(ln, next);
    clack(); renderSim();
  }

  function newSheet() {
    docLines = [ newLineObj() ]; simBelled = false;
    paperReturnAnim(); carriageReturn(); renderSim();
  }

  function lineText(ln) {
    return repeat(" ", lineLayout(ln).indent) + ln.g.map(function (g) { return g.c; }).join("");
  }
  function saveSheet() {
    commitBuffer();
    var txt = docLines.map(lineText).join("\n").replace(/[ \t]+$/gm, "");
    var blob = new Blob([txt + "\n"], { type: "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sabedevops-typewriter.txt";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
  }

  // Render the typed sheet as clean HTML (indent + colour/underline/bold) for print.
  function sheetHTML() {
    var out = "";
    for (var li = 0; li < docLines.length; li++) {
      var ln = docLines[li];
      out += escHtml(repeat(" ", lineLayout(ln).indent)) + glyphRuns(ln.g, true) + "\n";
    }
    return out;
  }

  // Print just the paper via a hidden iframe -> the OS print dialog.
  function printSheet() {
    commitBuffer();
    var frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(frame);
    var d = frame.contentWindow.document;
    d.open();
    d.write(
      '<!doctype html><html><head><title>sabedevops — typewriter</title>' +
      "<style>@page{margin:1in;}body{margin:0;}" +
      'pre{font-family:"Courier Prime","Courier New",monospace;font-size:12pt;line-height:1.5;' +
      "white-space:pre-wrap;word-break:break-word;color:#000;}" +
      ".r{color:#9d2b2b;}.u{text-decoration:underline;}.o{font-weight:bold;}" +
      "</style></head><body><pre>" + sheetHTML() + "</pre></body></html>"
    );
    d.close();
    setTimeout(function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {}
      setTimeout(function () { frame.remove(); }, 1500);
    }, 200);
  }

  function onSimKey(e) {
    if (e.key === "Escape")    { e.preventDefault(); closeSim(); return; }
    if (e.key === "Enter")     { e.preventDefault(); carriageReturnSim(); return; }
    if (e.key === "Backspace") { e.preventDefault(); backspaceSim(); return; }
    if (e.key === "Tab")       { e.preventDefault(); tabSim(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) { e.preventDefault(); printSheet(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1)    { e.preventDefault(); typeCharSim(e.key); }
  }
  // soft keyboards / IME: keydown gives no printable key, so use beforeinput
  function onSimBeforeInput(e) {
    if (e.inputType === "insertText" && e.data) {
      e.preventDefault();
      for (var i = 0; i < e.data.length; i++) typeCharSim(e.data[i]);
    } else if (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
      e.preventDefault(); carriageReturnSim();
    } else if (e.inputType === "deleteContentBackward") {
      e.preventDefault(); backspaceSim();
    }
  }

  function openTypewriter() {
    buildSim();
    twPrevMode = document.documentElement.getAttribute("data-mode") || "term";
    setMode("paper");                          // a typewriter lives on paper
    // reset to a clean machine
    leftMargin = 0; rightMargin = MAX_COLS; ribbon = "black";
    caps = false; autoReturn = false; bold = false; align = "normal"; underline = "off";
    alignBuf = []; alignAnchor = 0; decPhase = "int"; tabStops = [];
    docLines = [ newLineObj() ]; simBelled = false;
    setRibbon("black"); updatePanel(); renderSim();
    simRoot.classList.add("open");
    simOpen = true;
    audio();                                   // warm audio on the launching gesture
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () { twInput.focus({ preventScroll: true }); }, 30);
  }
  function closeSim() {
    if (!simRoot) return;
    simRoot.classList.remove("open");
    simOpen = false;
    if (twPrevMode) setMode(twPrevMode);       // restore the site's mode
    document.documentElement.style.overflow = "";
  }

  /* ============================================================
     typeracer — a terminal-styled typing speed test.
     Launched by the terminal `typeracer` command; switches the
     site to terminal mode to match.
     ============================================================ */
  var racerOpen = false, trPrevMode = null;
  var trRoot = null, trEls = {}, trInput = null;
  var trText = "", trSpans = [], trPos = 0;
  var trKeystrokes = 0, trErrors = 0, trStart = 0, trTimer = null, trDone = false;

  var RACES = [
    "The quick brown fox jumps over the lazy dog while the sleepy cat watches the rain.",
    "Programs must be written for people to read, and only incidentally for machines to execute.",
    "There are only two hard things in computer science: cache invalidation and naming things.",
    "Simplicity is a prerequisite for reliability, so make the common case fast and the rare case correct.",
    "A typewriter never crashes, never updates, and prints exactly what you type, in the order you type it.",
    "Talk is cheap. Show me the code, then the tests, and finally show me the thing running in production.",
    "The best way to predict the future is to implement it, ship it on Friday, and fix it over the weekend."
  ];

  function buildRacer() {
    if (trRoot) return;
    trRoot = document.createElement("div");
    trRoot.id = "typeracer";
    trRoot.setAttribute("role", "dialog");
    trRoot.setAttribute("aria-label", "Typeracer typing test");
    trRoot.innerHTML =
      '<div class="tr-stage">' +
        '<div class="tr-titlebar">' +
          '<span class="tr-lights"><span class="l r"></span><span class="l y"></span><span class="l g"></span></span>' +
          '<span class="tr-title">typeracer — sabedevops@dev</span>' +
          '<button class="tr-close" type="button" aria-label="Close typeracer">esc ✕</button>' +
        '</div>' +
        '<div class="tr-body">' +
          '<div class="tr-passage" id="tr-passage"></div>' +
          '<div class="tr-result" id="tr-result" hidden></div>' +
          '<div class="tr-stats">' +
            '<span class="tr-stat"><b id="tr-wpm">0</b> wpm</span>' +
            '<span class="tr-stat"><b id="tr-acc">100</b>% acc</span>' +
            '<span class="tr-stat"><b id="tr-time">0.0</b>s</span>' +
            '<span class="tr-stat"><b id="tr-prog">0</b>%</span>' +
          '</div>' +
          '<div class="tr-controls">' +
            '<button class="tr-btn" data-act="restart" type="button">restart</button>' +
            '<button class="tr-btn" data-act="new" type="button">new text</button>' +
          '</div>' +
          '<p class="tr-help">start typing to begin the clock · <b>backspace</b> to fix · <b>esc</b> to quit</p>' +
        '</div>' +
      '</div>';

    trInput = document.createElement("input");
    trInput.className = "tr-capture";
    trInput.setAttribute("aria-hidden", "true");
    trInput.autocapitalize = "off"; trInput.autocomplete = "off";
    trInput.autocorrect = "off"; trInput.spellcheck = false;
    trRoot.querySelector(".tr-stage").appendChild(trInput);
    document.body.appendChild(trRoot);

    trEls.passage = trRoot.querySelector("#tr-passage");
    trEls.result  = trRoot.querySelector("#tr-result");
    trEls.wpm     = trRoot.querySelector("#tr-wpm");
    trEls.acc     = trRoot.querySelector("#tr-acc");
    trEls.time    = trRoot.querySelector("#tr-time");
    trEls.prog    = trRoot.querySelector("#tr-prog");

    trRoot.querySelector(".tr-close").addEventListener("click", closeRacer);
    trRoot.addEventListener("mousedown", function (e) {
      if (e.target === trRoot) { closeRacer(); return; }
      if (e.target.closest(".tr-btn,.tr-close")) return;
      setTimeout(function () { trInput.focus({ preventScroll: true }); }, 0);
    });
    Array.prototype.forEach.call(trRoot.querySelectorAll(".tr-btn"), function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-act");
        if (act === "restart") loadRace(trText);
        else if (act === "new") loadRace(pickRace());
        trInput.focus();
      });
    });
    trInput.addEventListener("keydown", onRacerKey);
    trInput.addEventListener("beforeinput", onRacerBeforeInput);
    trInput.addEventListener("input", function () { trInput.value = ""; });
  }

  function pickRace() {
    var r;
    do { r = RACES[Math.floor(Math.random() * RACES.length)]; } while (RACES.length > 1 && r === trText);
    return r;
  }

  function loadRace(text) {
    trText = text; trPos = 0; trKeystrokes = 0; trErrors = 0; trStart = 0; trDone = false;
    if (trTimer) { clearInterval(trTimer); trTimer = null; }
    trEls.result.hidden = true; trEls.result.innerHTML = "";
    trEls.passage.style.display = "";
    trSpans = [];
    trEls.passage.innerHTML = "";
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = "tr-ch";
      s.textContent = text[i];
      trEls.passage.appendChild(s);
      trSpans.push(s);
    }
    if (trSpans[0]) trSpans[0].classList.add("cur");
    updateRacerStats();
  }

  function elapsedSec() { return trStart ? (Date.now() - trStart) / 1000 : 0; }
  function correctCount() {
    var n = 0;
    for (var i = 0; i < trPos; i++) if (trSpans[i].classList.contains("ok")) n++;
    return n;
  }
  function updateRacerStats() {
    var sec = elapsedSec(), correct = correctCount();
    trEls.wpm.textContent  = sec > 0 ? Math.round((correct / 5) / (sec / 60)) : 0;
    trEls.acc.textContent  = trKeystrokes > 0 ? Math.round((trKeystrokes - trErrors) / trKeystrokes * 100) : 100;
    trEls.time.textContent = sec.toFixed(1);
    trEls.prog.textContent = trText.length ? Math.round(trPos / trText.length * 100) : 0;
  }

  function typeRacerChar(c) {
    if (trDone || trPos >= trText.length) return;
    if (!trStart) { trStart = Date.now(); trTimer = setInterval(updateRacerStats, 100); }
    trKeystrokes++;
    var span = trSpans[trPos];
    span.classList.remove("cur");
    if (c === trText[trPos]) { span.classList.add("ok"); clack(); }
    else { span.classList.add("bad"); trErrors++; tone(160, 0.05, "square", 0.03); }
    trPos++;
    if (trSpans[trPos]) trSpans[trPos].classList.add("cur");
    if (trPos >= trText.length) finishRace();
    updateRacerStats();
  }
  function backRacer() {
    if (trDone || trPos <= 0) return;
    if (trSpans[trPos]) trSpans[trPos].classList.remove("cur");
    trPos--;
    trSpans[trPos].classList.remove("ok", "bad");
    trSpans[trPos].classList.add("cur");
    updateRacerStats();
  }

  function finishRace() {
    trDone = true;
    if (trTimer) { clearInterval(trTimer); trTimer = null; }
    updateRacerStats();
    var sec = elapsedSec(), correct = correctCount();
    var wpm = sec > 0 ? Math.round((correct / 5) / (sec / 60)) : 0;
    var acc = trKeystrokes > 0 ? Math.round((trKeystrokes - trErrors) / trKeystrokes * 100) : 100;
    tone(880, 0.12, "sine", 0.05); tone(1320, 0.16, "sine", 0.04, 0.08);
    trEls.passage.style.display = "none";
    trEls.result.innerHTML =
      '<div class="tr-big">' + wpm + ' <span>wpm</span></div>' +
      '<div class="tr-sub">' + acc + '% accuracy · ' + sec.toFixed(1) + 's · ' + trText.length + ' chars</div>' +
      '<div class="tr-again">press <b>enter</b> for a new text · <b>esc</b> to quit</div>';
    trEls.result.hidden = false;
  }

  function onRacerKey(e) {
    if (e.key === "Escape") { e.preventDefault(); closeRacer(); return; }
    if (trDone) { if (e.key === "Enter") { e.preventDefault(); loadRace(pickRace()); } return; }
    if (e.key === "Backspace") { e.preventDefault(); backRacer(); return; }
    if (e.key === "Enter") { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1) { e.preventDefault(); typeRacerChar(e.key); }
  }
  function onRacerBeforeInput(e) {
    if (trDone) { e.preventDefault(); return; }
    if (e.inputType === "insertText" && e.data) {
      e.preventDefault();
      for (var i = 0; i < e.data.length; i++) typeRacerChar(e.data[i]);
    } else if (e.inputType === "deleteContentBackward") {
      e.preventDefault(); backRacer();
    }
  }

  function openTyperacer() {
    buildRacer();
    trPrevMode = document.documentElement.getAttribute("data-mode") || "term";
    setMode("term");                           // the racer runs in the terminal
    trText = RACES[0];                         // seed so the opener never lands on the pangram
    loadRace(pickRace());
    trRoot.classList.add("open");
    racerOpen = true;
    audio();
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () { trInput.focus({ preventScroll: true }); }, 30);
  }
  function closeRacer() {
    if (!trRoot) return;
    if (trTimer) { clearInterval(trTimer); trTimer = null; }
    trRoot.classList.remove("open");
    racerOpen = false;
    if (trPrevMode) setMode(trPrevMode);       // restore the site's mode
    document.documentElement.style.overflow = "";
  }

  // public API used by the hero terminal
  window.Teletype = window.Teletype || {};
  window.Teletype.typewriter = openTypewriter;
  window.Teletype.typeracer = openTyperacer;
  window.Teletype.setMode = setMode;
  window.Teletype.egg = typewriterReveal;
})();

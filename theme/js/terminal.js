/* ============================================================
   terminal.js — the interactive hero shell on the homepage.
   A tiny, friendly command line over the site's own content.
   ============================================================ */
(function () {
  "use strict";

  var repl    = document.getElementById("repl");
  var out     = document.getElementById("repl-output");
  var display = document.getElementById("repl-input");
  var caret   = document.getElementById("repl-caret");
  if (!repl || !out || !display) return;

  var data = { site: "sabedevops", user: "sabedevops", host: "dev",
               author: "sabedevops", siteurl: "", posts: [], pages: [], social: [] };
  try {
    var raw = document.getElementById("post-index");
    if (raw) data = Object.assign(data, JSON.parse(raw.textContent));
  } catch (e) {}

  var PROMPT = data.user + "@" + data.host + ":~$";
  var history = [];
  var hpos = -1;

  /* hidden input drives keyboard (incl. mobile) */
  var input = document.createElement("input");
  input.setAttribute("aria-hidden", "true");
  input.autocapitalize = "off";
  input.autocomplete = "off";
  input.autocorrect = "off";
  input.spellcheck = false;
  input.style.cssText =
    "position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;left:-9999px;";
  repl.appendChild(input);

  function sync() { display.textContent = input.value; }
  function focusInput() { input.focus({ preventScroll: true }); }
  repl.addEventListener("mousedown", function (e) {
    if (e.target.tagName === "A") return;   // let links work
    setTimeout(focusInput, 0);
  });
  display.addEventListener("focus", focusInput);
  input.addEventListener("input", sync);
  input.addEventListener("focus", function () { caret && (caret.style.opacity = ""); });

  /* ---------- output helpers ---------- */
  function line(html, cls) {
    var div = document.createElement("div");
    div.className = "line" + (cls ? " " + cls : "");
    div.innerHTML = html;
    out.appendChild(div);
    return div;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function echoCommand(cmd) {
    line('<span class="repl-prompt">' + esc(PROMPT) + '</span> ' + esc(cmd), "cmd-echo");
  }
  function scroll() { repl.scrollTop = repl.scrollHeight; }

  /* ---------- commands ---------- */
  var BANNER = [
    "           _              _                           ",
    " ___  __ _| |__   ___  __| | _____   _____  _ __  ___ ",
    "/ __|/ _` | '_ \\ / _ \\/ _` |/ _ \\ \\ / / _ \\| '_ \\/ __|",
    "\\__ \\ (_| | |_) |  __/ (_| |  __/\\ V / (_) | |_) \\__ \\",
    "|___/\\__,_|_.__/ \\___|\\__,_|\\___| \\_/ \\___/| .__/|___/",
    "                                           |_|        "
  ].join("\n");

  var commands = {
    help: function () {
      line("available commands:");
      line("  <span class='ok'>help</span>       this list");
      line("  <span class='ok'>whoami</span>     who runs this box");
      line("  <span class='ok'>ls</span>         list posts (try <span class='muted'>ls pages</span>)");
      line("  <span class='ok'>cat</span> &lt;name&gt; read a post's summary");
      line("  <span class='ok'>open</span> &lt;name&gt; jump to a post");
      line("  <span class='ok'>about</span>      about this site");
      line("  <span class='ok'>social</span>     where else to find me");
      line("  <span class='ok'>typewriter</span> open the typewriter simulator ⌨");
      line("  <span class='ok'>typeracer</span>  race a typing speed test ⚡");
      line("  <span class='ok'>neofetch</span>   system info");
      line("  <span class='ok'>banner</span>     print the logo");
      line("  <span class='ok'>clear</span>      wipe the screen");
      line("  <span class='ok'>exit</span>       close this session");
      line("<span class='muted'>tip: press <b>tab</b> to complete · <b>`</b> (backtick) to switch term/paper mode.</span>");
    },
    whoami: function () {
      line("<span class='ok'>" + esc(data.author) + "</span> — developer, tinkerer, keyboard enthusiast.");
      line("this is the blog. mostly linux, ops, and things that go <span class='muted'>clack</span>.");
    },
    ls: function (args) {
      var what = (args[0] || "posts").replace(/\/$/, "");
      if (what === "pages") {
        if (!data.pages.length) return line("total 0", "muted");
        data.pages.forEach(function (p) {
          line("<a href='" + esc(p.url) + "'>" + esc(p.slug) + "</a>");
        });
        return;
      }
      if (!data.posts.length) return line("total 0 — no posts yet.", "muted");
      line("total " + data.posts.length, "muted");
      data.posts.forEach(function (p) {
        line("<span class='muted'>" + esc(p.date) + "</span>  " +
             "<a href='" + esc(p.url) + "'>" + esc(p.slug) + ".md</a>" +
             (p.category ? "  <span class='muted'>[" + esc(p.category) + "]</span>" : ""));
      });
    },
    cat: function (args) {
      var name = (args[0] || "").replace(/\.md$/, "");
      if (!name) return line("usage: cat &lt;name&gt;", "err");
      var p = find(name);
      if (!p) return line("cat: " + esc(name) + ": no such post", "err");
      line("<b>" + esc(p.title) + "</b>  <span class='muted'>(" + esc(p.date) + ")</span>");
      if (p.summary) line(esc(p.summary));
      line("<a href='" + esc(p.url) + "'>→ open " + esc(p.slug) + "</a>");
    },
    open: function (args) {
      var name = (args[0] || "").replace(/\.md$/, "");
      var p = find(name);
      if (!p) return line("open: " + esc(name) + ": not found", "err");
      line("opening " + esc(p.title) + " …", "muted");
      window.location.href = p.url;
    },
    about: function () {
      var about = data.pages.find(function (p) { return p.slug === "about"; });
      if (about) { line("opening about …", "muted"); window.location.href = about.url; return; }
      line("a personal blog by " + esc(data.author) + ".");
    },
    social: function () {
      if (!data.social.length) return line("no links configured.", "muted");
      data.social.forEach(function (s) {
        line(esc(s.name) + ": <a href='" + esc(s.url) + "' target='_blank' rel='noopener'>" + esc(s.url) + "</a>");
      });
    },
    contact: function () { commands.social(); },
    typewriter: function () {
      if (window.Teletype && window.Teletype.typewriter) {
        line("loading typewriter … <span class='muted'>a real one. type away — esc to leave.</span>", "muted");
        window.Teletype.typewriter();
      } else {
        line("typewriter: simulator failed to load (typewriter.js missing)", "err");
      }
    },
    typeracer: function () {
      if (window.Teletype && window.Teletype.typeracer) {
        line("starting typeracer … <span class='muted'>type the passage as fast as you can.</span>", "muted");
        window.Teletype.typeracer();
      } else {
        line("typeracer: failed to load (typewriter.js missing)", "err");
      }
    },
    neofetch: function () {
      var rows = [
        [data.user + "@" + data.host, ""],
        ["os", "sabedevops linux (rolling)"],
        ["shell", "teletype 1.0"],
        ["theme", document.documentElement.getAttribute("data-mode") === "paper" ? "paper (ink on cream)" : "amber phosphor"],
        ["kbd", "mechanical, tactile, too loud"],
        ["uptime", "long enough to know better"],
        ["posts", String(data.posts.length)]
      ];
      line("<pre class='banner'>" + esc(logoSmall()) + "</pre>");
      rows.forEach(function (r) {
        line("<span class='ok'>" + esc(r[0]) + "</span>" + (r[1] ? ": " + esc(r[1]) : ""));
      });
    },
    banner: function () { line("<pre class='banner'>" + esc(BANNER) + "</pre>"); },
    echo: function (args) { line(esc(args.join(" "))); },
    date: function () { line(new Date().toString()); },
    pwd: function () { line("/home/" + data.user); },
    uname: function () { line("teletype sabedevops 1.0 x86_64 GNU/Linux"); },
    history: function () {
      history.forEach(function (h, i) { line("  " + (i + 1) + "  " + esc(h)); });
    },
    clear: function () { out.innerHTML = ""; },
    sudo: function (args) {
      line(esc(data.user) + " is not in the sudoers file. This incident will be reported.", "err");
    },
    exit: function () {
      line("logging out — closing session …", "muted");
      setTimeout(function () {
        // Re-owning the window lets some browsers permit a self-close.
        try { window.open("", "_self"); } catch (e) {}
        window.close();
        // If the browser refuses to close a normal tab, say so.
        setTimeout(function () {
          line("your browser won't let a page close its own tab — press " +
               (navigator.platform.indexOf("Mac") === 0 ? "⌘W" : "Ctrl+W") + " to close.", "muted");
          scroll();
        }, 250);
      }, 350);
    },
    hint: function () {
      line("two things worth finding:", "muted");
      line("  · run <span class='ok'>typewriter</span> for a full manual typewriter.", "muted");
      line("  · or type a long line anywhere on the page and listen", "muted");
      line("    for the margin bell — a real typist knows what's next.", "muted");
    }
  };
  // aliases
  commands.posts = commands.ls;
  commands.blog = commands.ls;
  commands.ll = commands.ls;
  commands.man = commands.help;
  commands.type = commands.typewriter;
  commands.tw = commands.typewriter;
  commands.race = commands.typeracer;

  function find(name) {
    name = name.toLowerCase();
    return data.posts.find(function (p) {
      return p.slug.toLowerCase() === name || p.slug.toLowerCase() === name.replace(/\.md$/, "");
    });
  }
  function logoSmall() {
    return " .--.\n" +
           " |>_<|   sabedevops\n" +
           " '--'    ~/blog";
  }

  /* ---------- tab completion ---------- */
  function commandPool() {
    var seen = {}, out = [];
    Object.keys(commands).concat(["cd"]).forEach(function (k) {
      if (!seen[k]) { seen[k] = 1; out.push(k); }
    });
    return out;
  }
  function lcp(arr) {                 // longest common prefix
    if (!arr.length) return "";
    var p = arr[0];
    for (var i = 1; i < arr.length; i++) {
      while (arr[i].toLowerCase().indexOf(p.toLowerCase()) !== 0) {
        p = p.slice(0, -1);
        if (!p) return "";
      }
    }
    return p;
  }
  function completeValue(val) {
    var tokens = val.split(/\s+/);
    var idx = tokens.length - 1;
    var frag = tokens[idx];
    var pool;
    if (idx === 0) {
      pool = commandPool();
    } else {
      var cmd = tokens[0].toLowerCase();
      if (cmd === "cat" || cmd === "open" || cmd === "cd") {
        pool = data.posts.map(function (p) { return p.slug; });
      } else if (cmd === "ls" || cmd === "ll") {
        pool = ["posts", "pages"];
      } else {
        pool = [];
      }
    }
    var f = frag.toLowerCase();
    var matches = pool.filter(function (x) { return x.toLowerCase().indexOf(f) === 0; });
    if (!matches.length) return { value: val, options: [] };
    var pref = matches.length === 1 ? matches[0] + (idx === 0 ? " " : "") : lcp(matches);
    tokens[idx] = pref;
    return { value: tokens.join(" "), options: matches.length > 1 ? matches.slice().sort() : [] };
  }

  function run(raw) {
    var cmd = raw.trim();
    if (!cmd) return;
    history.push(cmd); hpos = history.length;
    echoCommand(cmd);
    var parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    var name = (parts.shift() || "").toLowerCase();
    var args = parts.map(function (a) { return a.replace(/^"|"$/g, ""); });
    if (name === "cd") {   // friendly cd handling
      var t = (args[0] || "").replace(/\/$/, "");
      if (t === "" || t === "~" || t === "..") { line("~", "muted"); return; }
      if (t.indexOf("posts") === 0) { return commands.open([t.split("/").pop()]); }
      return line("cd: " + esc(t) + ": try 'ls' then 'open <name>'", "muted");
    }
    if (commands[name]) { try { commands[name](args); } catch (e) { line("error: " + esc(e.message), "err"); } }
    else line("command not found: " + esc(name) + " — type <span class='ok'>help</span>", "err");
  }

  var emptyTabShown = false;               // true after an empty-line Tab printed help
  input.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") emptyTabShown = false;   // any non-Tab key re-arms the empty-Tab help
    if (e.key === "Enter") {
      e.preventDefault();
      var val = input.value;
      input.value = ""; sync();
      run(val);
      scroll();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hpos > 0) { hpos--; input.value = history[hpos] || ""; sync(); }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hpos < history.length - 1) { hpos++; input.value = history[hpos] || ""; sync(); }
      else { hpos = history.length; input.value = ""; sync(); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (input.value === "") {              // empty line: print help once, then do nothing
        if (emptyTabShown) return;
        commands.help();
        emptyTabShown = true;
        scroll();
        return;
      }
      var res = completeValue(input.value);   // normal completion (unchanged)
      if (res.value !== input.value) {         // extend as far as unambiguous
        input.value = res.value; sync();
      } else if (res.options.length) {         // already at common prefix: list matches side by side
        echoCommand(input.value);
        line(res.options.map(esc).join("&nbsp;&nbsp;&nbsp;"), "muted");
        scroll();
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault(); commands.clear();
    }
  });

  /* ---------- boot ---------- */
  line("<pre class='banner'>" + esc(BANNER) + "</pre>");
  line("welcome to <b>" + esc(data.site) + "</b> — a developer's teletype. v1.0", "muted");
  line("type <span class='ok'>help</span> to get started, or <span class='ok'>ls</span> to see the latest posts.", "muted");
  line("&nbsp;");
  focusInput();
})();

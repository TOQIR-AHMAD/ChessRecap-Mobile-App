// Smoke test: load the lite-single Stockfish 18 binary and run a short search.
// Confirms the WASM engine executes and that its UCI output matches our parser.
const initEngine = require("stockfish");

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const lines = [];

initEngine("lite-single").then((engine) => {
  engine.listener = (line) => {
    lines.push(line);
    if (/^info .*\bscore\b/.test(line) || line.startsWith("bestmove")) {
      console.log(line);
    }
    if (line.startsWith("bestmove")) {
      const sawScore = lines.some((l) => /^info .*\bscore (cp|mate)\b/.test(l));
      const sawPv = lines.some((l) => /^info .*\bpv\b/.test(l));
      console.log(
        `\nRESULT: score lines=${sawScore} pv lines=${sawPv} bestmove="${line.split(" ")[1]}"`,
      );
      console.log(sawScore && sawPv && line.split(" ")[1] ? "SMOKE_OK" : "SMOKE_FAIL");
      process.exit(0);
    }
  };
  engine.sendCommand("uci");
  engine.sendCommand("isready");
  engine.sendCommand(`position fen ${START}`);
  engine.sendCommand("go depth 12");
});

setTimeout(() => {
  console.error("TIMEOUT — no bestmove within 60s");
  process.exit(1);
}, 60000);

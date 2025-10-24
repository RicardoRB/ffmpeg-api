// ffmpegService.js
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { log } = require("../utils/logger");

function validateCommandTemplate(cmd) {
  if (typeof cmd !== "string") {
    log("error", "validateCommandTemplate: not a string", { valueType: typeof cmd });
    return { ok: false, message: "full_command debe ser una cadena." };
  }

  if (!cmd.includes("{input}") || !cmd.includes("{output}")) {
    log("error", "validateCommandTemplate: missing placeholders", { cmdSnippet: cmd.slice(0,200) });
    return {
      ok: false,
      message: "La plantilla debe incluir {input} y {output}.",
    };
  }

  if (!/^\s*ffmpeg\b/.test(cmd)) {
    log("error", 'validateCommandTemplate: does not start with ffmpeg', { cmdSnippet: cmd.slice(0,200) });
    return { ok: false, message: 'La plantilla debe empezar con "ffmpeg".' };
  }

//   const blocked = [";", "\\|", "&", "\\$", "`", "\\$\\(", "\\n", "\\r", "rm\\s", "rmdir\\s", "sudo\\s"];
//   for (const b of blocked) {
//     const re = new RegExp(b, "i");
//     if (re.test(cmd)) {
//       log("error", "validateCommandTemplate: blocked construct", { blocked: b.replace(/\\/g,""), cmdSnippet: cmd.slice(0,200) });
//       return {
//         ok: false,
//         message: `Caracter o constructo no permitido en la plantilla: ${b.replace(/\\/g, "")}`,
//       };
//     }
//   }

//   if (/[<>]/.test(cmd)) {
//     log("error", "validateCommandTemplate: redirection detected", { cmdSnippet: cmd.slice(0,200) });
//     return { ok: false, message: "Redirecciones no permitidas (< o >)." };
//   }

//   if (cmd.length > 2000) {
//     log("error", "validateCommandTemplate: command too long", { length: cmd.length });
//     return { ok: false, message: "Comando demasiado largo." };
//   }

  log("info", "validateCommandTemplate: ok", { cmdSnippet: cmd.slice(0,120) });
  return { ok: true };
}

function parseCommandArgs(cmdStr) {
  cmdStr = cmdStr.trim();
  const args = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  
  for (let i = 0; i < cmdStr.length; i++) {
    const ch = cmdStr[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) args.push(current);
  return args;
}

function estimateDurationFromFfprobe(stderr) {
  const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/i);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
    return Math.round(h * 3600 + min * 60 + sec);
  }
  return null;
}

function makeJobDir(jobId) {
  const dir = path.join("/tmp", `ffmpeg-job-${jobId}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runFfmpeg(jobId, template, inputPath, outputExt, jobRecord) {
  return new Promise((resolve) => {
    const jobDir = makeJobDir(jobId);
    const outputFile = path.join(jobDir, `output.${outputExt}`);
    const cmd = template
      .replace(/{input}/g, inputPath)
      .replace(/{output}/g, outputFile);

    const args = parseCommandArgs(cmd);

    if (args.length === 0 || args[0] !== "ffmpeg") {
      jobRecord.status = "ERROR";
      jobRecord.error = "Comando inválido: no empieza por ffmpeg en args.";
      log("error", "runFfmpeg: invalid command (not starting with ffmpeg)", {
        jobId,
        partialCmd: cmd.slice(0, 200),
      });
      return resolve();
    }
    args.shift();

    jobRecord.status = "PROCESSING";
    jobRecord.startedAt = new Date().toISOString();
    log("info", "runFfmpeg: starting ffmpeg", { jobId, argsCount: args.length });

    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    ff.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      if (s.length < 1000) log("debug", "ffmpeg_stdout", { jobId, data: s });
    });
    ff.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      log("debug", "ffmpeg_stderr_chunk", { jobId, chunk: s.slice(0, 500) });
    });

    ff.on("error", (err) => {
      jobRecord.status = "ERROR";
      jobRecord.error = `spawn error: ${err.message}`;
      jobRecord.finishedAt = new Date().toISOString();
      log("error", "runFfmpeg: spawn error", { jobId, err: err.message });
      resolve();
    });

    ff.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputFile)) {
        jobRecord.status = "FINISHED";
        jobRecord.finishedAt = new Date().toISOString();
        jobRecord.outputPath = outputFile;
        jobRecord.outputExt = outputExt;
        jobRecord.duration_seconds = estimateDurationFromFfprobe(stderr) || null;
        log("info", "runFfmpeg: finished successfully", {
          jobId,
          output: outputFile,
          duration_seconds: jobRecord.duration_seconds,
        });
      } else {
        jobRecord.status = "ERROR";
        jobRecord.error = `ffmpeg exited with code ${code}. stderr: ${stderr.slice(0, 1000)}`;
        jobRecord.finishedAt = new Date().toISOString();
        log("error", "runFfmpeg: ffmpeg failed", {
          jobId,
          exitCode: code,
          stderrSnippet: stderr.slice(0, 1000),
        });
      }
      resolve();
    });
  });
}

module.exports = {
  validateCommandTemplate,
  runFfmpeg,
  makeJobDir,
  parseCommandArgs,
};
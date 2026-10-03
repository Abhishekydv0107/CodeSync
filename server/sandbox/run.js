import Docker from "dockerode";

const docker = new Docker(); // talks to the local Docker daemon

const IMAGE_BY_LANGUAGE = {
  python: "sandbox-python",
  javascript: "sandbox-node",
};

// Runs `code` in a short-lived, network-isolated container and returns its
// stdout+stderr as a string. Always removes the container when done,
// regardless of success, timeout, or crash.
export async function runInSandbox(code, language) {
  const image = IMAGE_BY_LANGUAGE[language];
  if (!image) throw new Error(`Unsupported language: ${language}`);

  const timeoutMs = Number(process.env.SANDBOX_TIMEOUT_MS || 5000);
  const memoryMb = Number(process.env.SANDBOX_MEMORY_MB || 128);
  const cpuQuota = Number(process.env.SANDBOX_CPU_QUOTA || 50000);

  const container = await docker.createContainer({
    Image: image,
    Cmd: ["run", code], // the image's entrypoint script decides how to execute this
    Tty: false,
    HostConfig: {
      NetworkMode: "none", // no network access at all from inside the sandbox
      Memory: memoryMb * 1024 * 1024,
      CpuQuota: cpuQuota, // 100000 = 1 full CPU; 50000 = half a CPU
      PidsLimit: 64, // stop fork-bombs
      AutoRemove: true,
    },
  });

  let timedOut = false;
  const killTimer = setTimeout(async () => {
    timedOut = true;
    try {
      await container.kill();
    } catch {
      // already stopped — fine
    }
  }, timeoutMs);

  try {
    await container.start();

    const stream = await container.logs({ follow: true, stdout: true, stderr: true });
    const output = await streamToString(stream);

    await container.wait().catch(() => {}); // container may already be auto-removed

    return timedOut ? `${output}\n[killed: exceeded ${timeoutMs}ms time limit]` : output;
  } finally {
    clearTimeout(killTimer);
  }
}

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

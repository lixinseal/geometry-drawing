const targetUrl = "http://127.0.0.1:4173/";
const debugUrl = "http://127.0.0.1:9223";

async function main() {
  const targets = await fetch(`${debugUrl}/json/list`).then((response) =>
    response.json()
  );
  const pageTarget = targets.find((target) => target.type === "page");
  if (!pageTarget) throw new Error("No Edge page target found");

  const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: targetUrl });
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const beforeResult = await send("Runtime.evaluate", {
    expression: "window.__geometryDebug?.camera()",
    returnByValue: true
  });
  const rectResult = await send("Runtime.evaluate", {
    expression:
      "JSON.stringify(document.getElementById('viewport').getBoundingClientRect().toJSON())",
    returnByValue: true
  });
  const before = beforeResult.result.value;
  const rect = JSON.parse(rectResult.result.value);
  const x = rect.x + rect.width * 0.55;
  const y = rect.y + rect.height * 0.55;

  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none"
  });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "right",
    buttons: 2,
    clickCount: 1
  });
  for (let step = 1; step <= 10; step += 1) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x + step * 14,
      y: y + step * 7,
      button: "right",
      buttons: 2
    });
  }
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: x + 140,
    y: y + 70,
    button: "right",
    buttons: 0,
    clickCount: 1
  });
  await new Promise((resolve) => setTimeout(resolve, 500));

  const afterResult = await send("Runtime.evaluate", {
    expression: "window.__geometryDebug?.camera()",
    returnByValue: true
  });
  const after = afterResult.result.value;
  console.log(
    JSON.stringify(
      {
        before,
        after,
        targetMoved: after.target.some(
          (value, index) => Math.abs(value - before.target[index]) > 0.01
        )
      },
      null,
      2
    )
  );
  socket.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

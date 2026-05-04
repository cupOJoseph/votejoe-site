const http = require("http");
const { handleRequest } = require("./handler");

const startPort = Number(process.env.PORT || 4173);
const server = http.createServer((req, res) => handleRequest(req, res));

function listen(port) {
  server.removeAllListeners("error");
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }
    throw err;
  });
  server.listen(port, "127.0.0.1");
}

server.on("listening", () => {
  console.log(`votejoe static clone: http://localhost:${server.address().port}`);
});

listen(startPort);

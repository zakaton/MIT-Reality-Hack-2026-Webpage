import express from "express";
import https, { Server } from "https";
import http from "http";
const app = express();
import fs from "fs";
import ip from "ip";

process.on("warning", (e) => console.warn(e.stack));

// HTTPS SERVER
app.use(function (req, res, next) {
  //res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  //res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  //res.setHeader("X-Frame-Options", "SAMEORIGIN");

  // Add CORS headers
  res.header("Access-Control-Allow-Origin", "http://localhost"); // Adjust this to your allowed origin
  res.header("Access-Control-Allow-Origin", "https://localhost"); // Adjust this to your allowed origin
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS"); // Allowed HTTP methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allowed headers
  res.setHeader("Access-Control-Allow-Credentials", "true"); // Allow cookies or other credentials if needed

  // Handle preflight requests (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // No Content
  }

  next();
});

app.use((req, res, next) => {
  if (req.protocol !== "https") {
    return res.redirect(301, "https://" + req.headers.host + req.url); // Always redirect to HTTPS
  }
  next();
});
app.use(express.static("./"));
app.use(express.json());

const httpServer = http.createServer(app);
httpServer.listen(80, () => {
  console.log(
    `server listening on http://localhost and http://${ip.address()}`
  );
});

/** @type {Server?} */
let httpsServer;
const serverOptions = {
  key: fs.readFileSync("./sec/key.pem"),
  cert: fs.readFileSync("./sec/cert.pem"),
};
httpsServer = https.createServer(serverOptions, app);
httpsServer.listen(443, () => {
  console.log(
    `server listening on  https://localhost and https://${ip.address()}`
  );
});

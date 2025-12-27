const fs = require("fs");
const path = require("path");

const serviceAccountPath = path.join(
  __dirname,
  "credentials/vehiclepooling-f9bc8-771912438278.json"
);
const rawContent = fs.readFileSync(serviceAccountPath, "utf8");

console.log("=== RAW FILE CONTENT (first 500 chars) ===");
console.log(rawContent.substring(0, 500));

console.log("\n=== PARSED JSON ===");
const serviceAccount = JSON.parse(rawContent);

console.log("\n=== PRIVATE KEY INFO ===");
console.log("Private key type:", typeof serviceAccount.private_key);
console.log("Private key length:", serviceAccount.private_key.length);
console.log("\n=== FIRST 200 CHARS OF PRIVATE KEY ===");
console.log(serviceAccount.private_key.substring(0, 200));

console.log("\n=== CHECKING FOR ESCAPED NEWLINES ===");
const hasEscapedNewlines = serviceAccount.private_key.includes("\\n");
const hasActualNewlines = serviceAccount.private_key.includes("\n");
console.log("Has escaped \\n:", hasEscapedNewlines);
console.log("Has actual newlines:", hasActualNewlines);

console.log("\n=== ATTEMPTING TO FIX ===");
let fixedKey = serviceAccount.private_key;
if (!hasActualNewlines && hasEscapedNewlines) {
  fixedKey = fixedKey.replace(/\\n/g, "\n");
  console.log("Applied fix: replaced \\\\n with \\n");
} else {
  console.log("No fix needed or already has newlines");
}

console.log("\n=== FIXED KEY (first 200 chars) ===");
console.log(fixedKey.substring(0, 200));

const fs = require("fs");

const file = "src/controllers/trip.controller.ts";
let content = fs.readFileSync(file, "utf8");

// Fix multiline return statements
content = content.replace(/return res\s+\.status/g, "res.status");
content = content.replace(/return res\s+\(/g, "res(");

fs.writeFileSync(file, content);
console.log("✅ Fixed multiline returns in trip.controller.ts");

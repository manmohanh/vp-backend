const fs = require("fs");
const path = require("path");

const files = [
  "src/controllers/booking.controller.ts",
  "src/controllers/trip.controller.ts",
  "src/controllers/vehicle.controller.ts",
  "src/controllers/user.controller.ts",
  "src/controllers/coupon.controller.ts",
];

files.forEach((file) => {
  const filePath = path.join(__dirname, file);
  let content = fs.readFileSync(filePath, "utf8");

  // Fix: Replace 'return res.status(...).json(...)' with 'res.status(...).json(...); return;'
  content = content.replace(
    /return res\.(status\([^)]+\)\.json\([^;]+\));/g,
    "res.$1; return;"
  );
  content = content.replace(/return res\.(json\([^;]+\));/g, "res.$1; return;");

  // Fix: Change _req back to req where it's actually used
  content = content.replace(/} = _req\.body/g, "} = req.body");
  content = content.replace(/} = _req\.query/g, "} = req.query");
  content = content.replace(/} = _req\.params/g, "} = req.params");
  content = content.replace(/_req\.body/g, "req.body");
  content = content.replace(/_req\.query/g, "req.query");
  content = content.replace(/_req\.params/g, "req.params");

  // Fix function signatures that use req
  content = content.replace(/async \(_req: Request/g, "async (req: Request");

  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed ${file}`);
});

console.log("\n✅ All return statements fixed!");

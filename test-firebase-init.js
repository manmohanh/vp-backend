const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

console.log("Testing Firebase Admin SDK initialization...\n");

const serviceAccountPath = path.join(
  __dirname,
  "credentials/vehiclepooling-f9bc8-771912438278.json"
);

try {
  console.log("Method 1: Direct file path");
  const app1 = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccountPath),
    },
    "test-app-1"
  );
  console.log("✅ SUCCESS: Direct file path works!\n");
  app1.delete();
} catch (error) {
  console.error("❌ FAILED: Direct file path");
  console.error("Error:", error.message);
  console.error("");
}

try {
  console.log("Method 2: Parsed JSON object");
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );
  const app2 = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
    },
    "test-app-2"
  );
  console.log("✅ SUCCESS: Parsed JSON object works!\n");
  app2.delete();
} catch (error) {
  console.error("❌ FAILED: Parsed JSON object");
  console.error("Error:", error.message);
  console.error("");
}

try {
  console.log("Method 3: Parsed JSON with replace");
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  const app3 = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
    },
    "test-app-3"
  );
  console.log("✅ SUCCESS: Parsed JSON with replace works!\n");
  app3.delete();
} catch (error) {
  console.error("❌ FAILED: Parsed JSON with replace");
  console.error("Error:", error.message);
  console.error("");
}

console.log("Testing complete.");

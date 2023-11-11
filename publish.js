const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const packagesDir = path.join(__dirname, "packages");

console.log(`start publishing packages in ${packagesDir}`);

// execSync("git clean -dfx .");

// execSync("npm ci");

fs.readdirSync(packagesDir).forEach((packageName) => {
  const packagePath = path.join(packagesDir, packageName);

  updatePackageJson(packagePath);
  buildAndPublish(packagePath);
});

execSync(`git reset --hard`);

function updatePackageJson(packagePath) {
  const packageJsonPath = path.join(packagePath, "package.json");
  const packageJson = require(packageJsonPath);

  packageJson.main = "./dist/index.js";
  packageJson.types = "./dist/index.d.ts";
  packageJson.files = ["dist"];
  packageJson.publishConfig = {
    access: "public",
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function buildAndPublish(packagePath) {
  try {
    execSync("npx tsc --declaration --outDir dist", { cwd: packagePath });
    execSync("npm publish", { cwd: packagePath });
  } catch (error) {
    console.error(`Error building or publishing in ${packagePath}: ${error}`);
  }
}

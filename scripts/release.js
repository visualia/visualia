//@ts-nocheck

const fs = require("fs");
const path = require("path");
const semver = require("semver");
const { prompt } = require("enquirer");
const execa = require("execa");
const package = require("../package.json");
const { currentVersion, name } = package;
const versionIncrements = ["patch", "minor", "major"];

const inc = (i) => semver.inc(currentVersion, i);
const run = (bin, args, opts = {}) =>
  execa(bin, args, { stdio: "inherit", ...opts });
const step = (msg) => console.log(msg);

async function main() {
  let targetVersion;

  const { release } = await prompt({
    type: "select",
    name: "release",
    message: "Select release type",
    choices: versionIncrements
      .map((i) => `${i} (${inc(i)})`)
      .concat(["custom"]),
  });

  if (release === "custom") {
    targetVersion = (
      await prompt({
        type: "input",
        name: "version",
        message: "Input custom version",
        initial: currentVersion,
      })
    ).version;
  } else {
    targetVersion = release.match(/\((.*)\)/)[1];
  }

  if (!semver.valid(targetVersion)) {
    throw new Error(`Invalid target version: ${targetVersion}`);
  }

  const { yes: tagOk } = await prompt({
    type: "confirm",
    name: "yes",
    message: `Releasing v${targetVersion}. Confirm?`,
  });

  if (!tagOk) {
    return;
  }

  // step("\nRunning tests...");
  // await run("npm", ["run", "test"]);

  // Check if working directory is clean
  await run("git", ["diff", "--exit-code"]);

  // Update the package version.
  step("\nUpdating the package version...");
  updatePackage(targetVersion);

  // Build the package.
  step("\nBuilding the package...");
  await run("npm", ["run", "build"]);

  step("\nGenerating the changelog...");
  await run("npx", [
    "conventional-changelog",
    "-p",
    "angular",
    "-i",
    "CHANGELOG.md",
    "-s",
  ]);
  await run("npx", ["prettier", "--write", "CHANGELOG.md"]);

  // Commit changes to the Git and create a tag.
  step("\nCommitting changes...");
  await run("git", ["add", "package.json", "CHANGELOG.md"]);
  await run("git", ["commit", "-m", `release: v${targetVersion}`]);
  await run("git", ["tag", `v${targetVersion}`]);

  // Publish the package.
  step("\nPublishing the package...");
  await run("npm", ["publish"]);

  // Adding "latest" tag
  if (release !== "custom") {
    await run("npm", ["dist-tag", "add", `${name}@${targetVersion}`, "latest"]);
  }

  // Push to GitHub.
  step("\nPushing to GitHub...");
  await run("git", ["push", "origin", `refs/tags/v${targetVersion}`]);
  await run("git", ["push"]);

  const { yes: releaseOk } = await prompt({
    type: "confirm",
    name: "yes",
    message: `Adding Github release v${targetVersion} (requres gh installed) Confirm?`,
  });

  if (releaseOk) {
    await run("gh", [
      "release",
      "create",
      `v${targetVersion}`,
      "--notes",
      "New release",
    ]);
  }
}

function updatePackage(version) {
  const pkgPath = path.resolve(path.resolve(__dirname, ".."), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  pkg.version = version;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

main().catch((err) => console.error(err));

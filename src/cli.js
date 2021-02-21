async function cli(args) {
  const commander = require("commander");
  const util = require("util");
  const cbGlob = require("glob");
  const fs = require("fs/promises");
  const path = require("path");
  const { spawn } = require("child_process");
  const invariant = (cond, msg) => {
    if (!cond) {
      throw new Error(msg);
    }
  };

  const glob = util.promisify(cbGlob);
  const parsePkgJson = (pkgDir) => {
    const filePath = path.resolve(pkgDir, "package.json");
    return fs
      .readFile(filePath, { encoding: "utf8" })
      .then((f) => JSON.parse(f));
  };

  const program = new commander.Command();
  program
    .requiredOption(
      "-e --exclude <excluded packages>",
      "Comma separated list of excluded package dirnames. (Required)"
    )
    .option(
      "--cwd <directory>",
      "workspace root directory. (Default: current working directory)"
    )
    .option(
      "--modify",
      "Leave yarn.lock and package.json modifications in place after the operation completes. May be useful in a CI environment where yarn install is run multiple times."
    );

  program.version(process.env.npm_package_version);

  //TODO(leo): test more
  // .allowUnknownOption(true); //for reg. yarn options

  program.parse(args);
  const { cwd: baseCwd, exclude, modify } = program.opts();
  const cwd = baseCwd || process.cwd();
  const excludes = exclude.split(",");

  const resolveWith = (p) => path.resolve(cwd, p);

  const pkgJsonPath = resolveWith("package.json");
  console.log(pkgJsonPath);
  const yarnLockPath = resolveWith("yarn.lock");
  const tmpDir = await fs.mkdtemp("yarn-exclude-tmp");
  const tmpPackageJsonPath = path.resolve(tmpDir, "package.json");
  const tmpYarnLockPath = path.resolve(tmpDir, "yarn.lock");

  const packageJson = await parsePkgJson(cwd);

  invariant(
    !!packageJson.workspaces,
    `No 'workspaces' entry was found in package.json.`
  );

  const normalizedOrigWorkspacesVal = Array.isArray(packageJson.workspaces)
    ? { packages: packageJson.workspaces, nohoist: [] }
    : packageJson.workspaces;
  const packagesArr = normalizedOrigWorkspacesVal.packages;

  const packageDirs = (
    await Promise.all(packagesArr.map(resolveWith).map((pkg) => glob(pkg, {})))
  ).flat();

  invariant(!!packageDirs.length, `No packages found.`);
  const filtered = packageDirs
    .filter((w) => !excludes.includes(path.basename(w)))
    .map((p) => path.relative(cwd, p));
  const updatedPackageJson = {
    ...packageJson,
    workspaces: { ...normalizedOrigWorkspacesVal, packages: filtered },
  };

  await Promise.all([
    fs.copyFile(pkgJsonPath, tmpPackageJsonPath),

    fs.copyFile(yarnLockPath, tmpYarnLockPath),
  ]);

  const restoreFiles = async () => {
    await Promise.all([
      fs.copyFile(tmpPackageJsonPath, pkgJsonPath),

      fs.copyFile(tmpYarnLockPath, yarnLockPath),
    ]);

    await fs.rmdir(tmpDir, { recursive: true });
  };

  try {
    //write new package.json, run yarn
    await fs.writeFile(
      pkgJsonPath,
      JSON.stringify(updatedPackageJson, null, 2)
    );

    console.log(
      "Running yarn install with the following package exclusions:",
      excludes.join(" ")
    );

    const yarnProcess = spawn(
      "yarn",
      [
        "install",
        !modify && "--frozen-lockfile",
        "--cwd",
        cwd,
        //TODO(leo): vvv test more
        //    ...program.args.filter((a) => a !== "--frozen-lockfile"),
      ].filter((x) => x),
      {
        stdio: "inherit",
      }
    );

    yarnProcess.on("exit", function (code) {
      console.log("Install successful.");
      if (!modify) {
        restoreFiles();
      }

      if (code === 1) {
        throw new Error("Error occurred in yarn process.");
      }
    });
  } catch (e) {
    console.error(e);

    await restoreFiles();
    throw e;
  }
}

module.exports = cli;

async function cli(args) {
  const commander = require("commander");
  const util = require("util");
  const cbGlob = require("glob");
  const fs = require("fs/promises");
  const path = require("path");
  const { spawn } = require("child_process");
  const { version } = require("../package.json");
  const invariant = (cond, msg) => {
    if (!cond) {
      throw new Error(msg);
    }
  };

  const features = {
    argForwarding: false, //TODO(leo): test more before re-enabling
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
      "Leave yarn.lock and package.json modifications in place after the operation completes. May be useful in some CI environments."
    );
  if (features.argForwarding) {
    program.allowUnknownOption(true); //for reg. yarn options
  }

  program.version(version);

  program.parse(args);
  const { cwd: baseCwd, exclude, modify } = program.opts();
  const cwd = baseCwd || process.cwd();
  const excludes = exclude.split(",");

  const resolveWith = (p) => path.resolve(cwd, p);

  const pkgJsonPath = resolveWith("package.json");
  const yarnLockPath = resolveWith("yarn.lock");
  const tmpDir = await fs.mkdtemp(path.join(__dirname,  "../tmp", "yarn-exclude-tmp"));
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

  const rmTmp = () => fs.rmdir(tmpDir, { recursive: true });

  const restoreFiles = async () => {
    await Promise.all([
      fs.copyFile(tmpPackageJsonPath, pkgJsonPath),

      fs.copyFile(tmpYarnLockPath, yarnLockPath),
    ]);
    await rmTmp();
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
        ...(features.argForwarding
          ? program.args.filter((a) => a !== "--frozen-lockfile")
          : []),
      ].filter((x) => x),
      {
        stdio: "inherit",
      }
    );

    yarnProcess.on("exit", function (code) {
      if (code === 1) {
        //TODO(leo): vvv evaluate err cases more
        throw new Error("Error occurred in yarn process.");
      }
      console.log("Yarn install successful.");
      if (!modify) {
        restoreFiles();
      } else {
        rmTmp();
      }
    });
  } catch (e) {
    console.error(e);

    await restoreFiles();
    throw e;
  }
}

module.exports = cli;

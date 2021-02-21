(async function () {
  const commander = require("commander");
  const util = require("util");
  const cbGlob = require("glob");
  const fs = require("fs/promises");
  const fs2 = require("fs");
  const path = require("path");
  const { exec: cbExec, spawn } = require("child_process");
  const invariant = (cond, msg) => {
    if (!cond) {
      throw new Error(msg);
    }
  };

  //own implementation, to handle nonstandard structure of exec
  const toPromise = (fn) => {
    const wrappedFn = (...args) => {
      return new Promise((res, rej) => {
        console.log("prom", "in", ...args);

        fn.call(null, ...args, (err, ...resultArgs) => {
          console.log("cb");

          if (err) {
            console.error("err", err);
            rej(err);
            return;
          }
          console.log("prom", resultArgs);

          if (resultArgs.length > 1) {
            res(resultArgs);
          } else {
            res(resultArgs[0]);
          }
        });
      });
    };
    return wrappedFn;
  };
  const glob = toPromise(cbGlob);

  const parsePkgJson = (pkgDir) => {
    const filePath = path.resolve(pkgDir, "package.json");
    return fs
      .readFile(filePath, { encoding: "utf8" })
      .then((f) => JSON.parse(f));
  };

  const program = new commander.Command();
  program.version("0.0.1");
  program
    .requiredOption("-e --exclude <excludePkg>", "excluded package")
    .option(
      "--modify",
      "leave yarn.lock and package.json modifications in place. May be useful in a CI environment where yarn install is run multiple times."
    )
    .option("--cwd <directory>", "workspace root directory", process.cwd())

    //TODO(leo): vvv
    .allowUnknownOption(true); //for reg. yarn options

  program.parse(process.argv);
  const { cwd, exclude, modify } = program.opts();

  const resolveWith = (p) => path.resolve(cwd, p);

  const pkgJsonPath = resolveWith("package.json");
  console.log(pkgJsonPath);
  const yarnLockPath = resolveWith("yarn.lock");
  const tmpDir = await fs.mkdtemp("yarn-exclude-tmp");
  const tmpPackageJsonPath = path.resolve(tmpDir, "package.json");
  const tmpYarnLockPath = path.resolve(tmpDir, "yarn.lock");

  const packageJson = await parsePkgJson(cwd);
  console.log("yes", packageJson);
  invariant(
    !!packageJson.workspaces,
    `No 'workspaces' entry was found in package.json.`
  );

  const normalizedOrigWorkspacesVal = Array.isArray(packageJson.workspaces)
    ? { packages: packageJson.workspaces, nohoist: [] }
    : packageJson.workspaces;
  const packagesArr = normalizedOrigWorkspacesVal.packages;
  console.log("yes2", packageJson);

  const packageDirs = (
    await Promise.all(packagesArr.map(resolveWith).map((pkg) => glob(pkg, {})))
  ).flat();
  console.log("yes3", packageJson);

  invariant(!!packageDirs.length, `No packages found.`);

  const filtered = packageDirs
    .filter((w) => w !== exclude && path.basename(w) !== exclude)
    .map((p) => path.relative(cwd, p));
  const updatedPackageJson = {
    ...packageJson,
    workspaces: { ...normalizedOrigWorkspacesVal, packages: filtered },
  };

  console.log("tmp", updatedPackageJson);
  console.log("tmp", tmpDir);
  //TODO(leo): idea- dstructive operation safe rollback pkg for file work w Node?

  await Promise.all([
    fs.copyFile(pkgJsonPath, tmpPackageJsonPath),
    //TODO(leo): revert below

    fs.copyFile(yarnLockPath, tmpYarnLockPath),
  ]);

  const restoreFiles = async () => {
    await Promise.all([
      fs.copyFile(tmpPackageJsonPath, pkgJsonPath),
      //TODO(leo): revert below
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

    //TODO(leo): vvv rm force
    console.log(process.cwd());
    const yarnProcess = spawn(
      "yarn",
      [
        "install",
        !modify && "--frozen-lockfile",
        "--cwd",
        cwd,
        ...program.args.filter((a) => a !== "--frozen-lockfile"),
      ].filter((x) => x),
      {
        stdio: "inherit",
      }
    );

    yarnProcess.on("exit", function (code) {
      console.log("success.");
      if (!modify) {
        restoreFiles();
      }

      console.log("child process exited with code " + code.toString());
    });
  } catch (e) {
    console.error(e);
    console.log("restoring files");

    await restoreFiles();
    throw e;
  }

  //make new pkg json
  //run yarn
  //pass other ops?
  //handle --cwd
})();

(async function () {
  const commander = require("commander");
  const util = require("util");
  const cbGlob = require("glob");
  const fs = require("fs/promises");
  const path = require("path");

  const invariant = (cond, msg) => {
    if (!cond) {
      throw new Error(msg);
    }
  };
  const glob = (path, opts) => {
    return new Promise((res, rej) => {
      cbGlob(path, opts, (err, files) => {
        if (err) {
          rej(err);
        }
        res(files);
      });
    });
  };

  const parsePkgJson = (pkgDir) => {
    const filePath = path.resolve(pkgDir, "package.json");
    return fs
      .readFile(filePath, { encoding: "utf8" })
      .then((f) => JSON.parse(f));
  };

  //yarn-exclude three --frozen-lockfile
  const program = new commander.Command();
  program.version("0.0.1");
  program
    .requiredOption("-e --exclude <excludePkg>", "excluded package")
    .option(
      "-d --dir <directory>",

      "workspace root directory",
      process.cwd()
    )
    .allowUnknownOption(true);

  program.parse(process.argv);
  const { dir, exclude } = program.opts();
  console.log(program.opts());
  const resolveWith = (p) => path.resolve(dir, p);

  const pkgJsonPath = resolveWith("package.json");
  const tmpPkgJsonPath = path.resolve(".", "temp-package.json");

  const packageJson = await parsePkgJson(dir);

  invariant(
    !!packageJson.workspaces,
    `No 'workspaces' entry was found in package.json.`
  );

  const normalizedOrigWorkspacesVal = Array.isArray(packageJson.workspaces)
    ? { packages: packageJson.workspaces, nohoist: [] }
    : packageJson.workspaces;
  const packagesArr = normalizedOrigWorkspacesVal.packages;

  const packageDirs = (
    await Promise.all(packagesArr.map(resolveWith).map(glob))
  ).flat();

  invariant(!!packageDirs.length, `No packages found.`);

  const filtered = packageDirs.filter(
    (w) => w !== exclude && path.basename(w) !== exclude
  );
  const tmpPackageJson = {
    ...packageJson,
    workspaces: { ...normalizedOrigWorkspacesVal, packages: filtered },
  };

  console.log("tmp", tmpPackageJson);

  await fs.writeFile(path, JSON.stringify(tmpPackageJson), {
    encoding: "utf8",
  });

  //make new pkg json
  //run yarn
  //pass other ops?
  //handle --cwd
})();

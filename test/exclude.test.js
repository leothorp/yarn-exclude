#!/usr/bin/env node
var shell = require("shelljs");
const fs = require("fs");
const assert = (cond) => {
  if (!cond) throw new Error("FAILED");
};

const getConfigFiles = () => {
  const pkgJson = fs.readFileSync("./test/test-monorepo/package.json", "utf8");
  const yarnLock = fs.readFileSync("./test/test-monorepo/yarn.lock", "utf8");
  return { pkgJson, yarnLock };
};

const checkStrPresence = (shouldBePresent) => {
  const { pkgJson, yarnLock } = getConfigFiles();
  console.log()
  assert(pkgJson.includes("packages/three") && shouldBePresent);
  assert(yarnLock.includes("react") && shouldBePresent);
};

const execPromise = (cmd) => {
  console.log('yes')

  return new Promise((res, rej) => {
  console.log('in')

    shell.exec(
      cmd,
      { },
      (exitCode, stdout, stderr) => {
  console.log('postex', stderr)

        if (exitCode !== 0) {
        console.log('nozo');

          console.error(stderr);
          rej();
        }
        console.log(stdout);

        res();
      }
    );
  });
};

//reseed test monorepo, run it with the package 'three' excluded
const projRoot = __dirname + "/../";
const setupStr = `cd ${projRoot} && yarn cache clean &&
    cp -R ./test/_test-monorepo-fixture ./test/test-monorepo`;
const modifyStr = `./bin/yarn-exclude.js --cwd ./test/test-monorepo --exclude three --modify`;
execPromise(setupStr)
  .then(() => {
    checkStrPresence(true);
  })
  .then(() => execPromise(modifyStr))
  .then(() => {
    //check for expected modifications
    checkStrPresence(false);
    console.log("PASSED");

    execPromise(`rm -rf ./test/test-monorepo`);
  });
